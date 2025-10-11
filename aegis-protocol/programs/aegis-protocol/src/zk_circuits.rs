use halo2::plonk::{Circuit, ConstraintSystem, Error, TableColumn};
use halo2::circuit::{SimpleFloorPlanner, Layouter};
use halo2::pasta::{Fp, EqAffine};
use halo2::poly::Rotation;
use poseidon_hash::hash;
use std::marker::PhantomData;
use halo2::plonk::{create_proof, keygen_pk, keygen_vk, verify_proof as halo2_verify_proof, ProvingKey, VerifyingKey, SingleVerifier};
use halo2::poly::commitment::Params;
use halo2::transcript::{Blake2bWrite, Blake2bRead, Challenge255};
use rand::rngs::OsRng;

#[derive(Clone)]
pub struct HedgeConfig {
    pub commitment_hash: TableColumn,
    pub oracle_price: TableColumn,
    pub volatility_metric: TableColumn,
    pub yield_threshold: TableColumn,
    pub agent_decision: TableColumn,
    pub computed_hash: TableColumn,
    pub decision_valid: TableColumn,
}

#[derive(Clone)]
pub struct HedgeValidityCircuit<F: halo2::arithmetic::FieldExt> {
    pub public_commitment_hash: F,
    pub public_oracle_price: F,
    pub private_volatility_metric: F,
    pub private_yield_threshold: F,
    pub private_agent_decision: F,
    _marker: PhantomData<F>,
}

impl<F: halo2::arithmetic::FieldExt> HedgeValidityCircuit<F> {
    pub fn new(
        commitment_hash: F,
        oracle_price: F,
        volatility_metric: F,
        yield_threshold: F,
        agent_decision: F,
    ) -> Self {
        Self {
            public_commitment_hash: commitment_hash,
            public_oracle_price: oracle_price,
            private_volatility_metric: volatility_metric,
            private_yield_threshold: yield_threshold,
            private_agent_decision: agent_decision,
            _marker: PhantomData,
        }
    }
}

impl<F: halo2::arithmetic::FieldExt> Circuit<F> for HedgeValidityCircuit<F> {
    type Config = HedgeConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self::new(F::zero(), F::zero(), F::zero(), F::zero(), F::zero())
    }

    fn configure(meta: &mut ConstraintSystem<F>) -> Self::Config {
        let commitment_hash = meta.instance_column();
        let oracle_price = meta.instance_column();
        let volatility_metric = meta.advice_column();
        let yield_threshold = meta.advice_column();
        let agent_decision = meta.advice_column();
        let computed_hash = meta.advice_column();
        let decision_valid = meta.advice_column();

        meta.enable_equality(commitment_hash);
        meta.enable_equality(oracle_price);
        meta.enable_equality(volatility_metric);
        meta.enable_equality(yield_threshold);
        meta.enable_equality(agent_decision);
        meta.enable_equality(computed_hash);
        meta.enable_equality(decision_valid);

        // Gate 1: decision_valid = (agent_decision == 1) if (oracle_price < yield_threshold) else 0
        meta.create_gate("decision_gate", |meta| {
            let oracle_price = meta.query_instance(oracle_price, Rotation::cur());
            let yield_threshold = meta.query_advice(yield_threshold, Rotation::cur());
            let agent_decision = meta.query_advice(agent_decision, Rotation::cur());
            let decision_valid = meta.query_advice(decision_valid, Rotation::cur());

            // Simplified: decision_valid = agent_decision * (yield_threshold - oracle_price > 0 ? 1 : 0)
            // But for bool, use lookup table
            vec![decision_valid - agent_decision]
        });

        // Gate 2: computed_hash == poseidon_hash(volatility_metric, yield_threshold, agent_decision)
        meta.create_gate("hash_gate", |meta| {
            let vol = meta.query_advice(volatility_metric, Rotation::cur());
            let thresh = meta.query_advice(yield_threshold, Rotation::cur());
            let dec = meta.query_advice(agent_decision, Rotation::cur());
            let comp_hash = meta.query_advice(computed_hash, Rotation::cur());

            // Placeholder constraint; actual Poseidon would need full circuit implementation
            vec![comp_hash - (vol + thresh + dec)]
        });

        // Gate 3: range check oracle_price
        meta.create_gate("range_gate", |meta| {
            let oracle_price = meta.query_instance(oracle_price, Rotation::cur());
            // Simplified range check
            vec![oracle_price]
        });

        HedgeConfig {
            commitment_hash,
            oracle_price,
            volatility_metric,
            yield_threshold,
            agent_decision,
            computed_hash,
            decision_valid,
        }
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<F>,
    ) -> Result<(), Error> {
        layouter.assign_region(
            || "hash_region",
            |mut region| {
                region.assign_advice(|| "vol", config.volatility_metric, 0, || Ok(self.private_volatility_metric))?;
                region.assign_advice(|| "thresh", config.yield_threshold, 0, || Ok(self.private_yield_threshold))?;
                region.assign_advice(|| "dec", config.agent_decision, 0, || Ok(self.private_agent_decision))?;
                // Compute hash here, but simplified
                let hash_val = self.private_volatility_metric + self.private_yield_threshold + self.private_agent_decision;
                region.assign_advice(|| "comp_hash", config.computed_hash, 0, || Ok(hash_val))?;
                Ok(())
            },
        )?;

        layouter.assign_region(
            || "decision_region",
            |mut region| {
                let decision_val = if self.public_oracle_price < self.private_yield_threshold { self.private_agent_decision } else { F::zero() };
                region.assign_advice(|| "decision_valid", config.decision_valid, 0, || Ok(decision_val))?;
                Ok(())
            },
        )?;

        Ok(())
    }
}

pub fn setup_params(k: u32) -> Params<EqAffine> {
  Params::<EqAffine>::new(k)
}

pub fn generate_keys(
  params: &Params<EqAffine>,
  circuit: &HedgeValidityCircuit<Fp>,
) -> Result<(ProvingKey<EqAffine>, VerifyingKey<EqAffine>), Error> {
  let vk = keygen_vk(params, circuit)?;
  let pk = keygen_pk(params, vk.clone(), circuit)?;
  Ok((pk, vk))
}

pub fn generate_proof(
  params: &Params<EqAffine>,
  pk: &ProvingKey<EqAffine>,
  circuit: HedgeValidityCircuit<Fp>,
  public_inputs: &[&[Fp]],
) -> Result<Vec<u8>, Error> {
  let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(vec![]);
  
  create_proof(
    params,
    pk,
    &[circuit],
    &[public_inputs],
    OsRng,
    &mut transcript,
  )?;
  
  Ok(transcript.finalize())
}

pub fn verify_proof(
  params: &Params<EqAffine>,
  vk: &VerifyingKey<EqAffine>,
  proof: &[u8],
  public_inputs: &[&[Fp]],
) -> Result<bool, Error> {
  let strategy = SingleVerifier::new(params);
  let mut transcript = Blake2bRead::<_, _, Challenge255<_>>::init(proof);
  
  match halo2_verify_proof(
    params,
    vk,
    strategy,
    &[public_inputs],
    &mut transcript,
  ) {
    Ok(_) => Ok(true),
    Err(e) => Err(e),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_proof_generation_and_verification() {
    let k = 4;
    let params = setup_params(k);
    
    let circuit = HedgeValidityCircuit::new(
      Fp::from(123),
      Fp::from(100),
      Fp::from(50),
      Fp::from(110),
      Fp::from(1),
    );
    
    let (pk, vk) = generate_keys(&params, &circuit).unwrap();
    
    let public_inputs = vec![
      vec![circuit.public_commitment_hash],
      vec![circuit.public_oracle_price],
    ];
    let public_inputs_refs: Vec<&[Fp]> = public_inputs.iter().map(|v| v.as_slice()).collect();
    
    let proof = generate_proof(&params, &pk, circuit.clone(), &public_inputs_refs).unwrap();
    
    let verified = verify_proof(&params, &vk, &proof, &public_inputs_refs).unwrap();
    assert!(verified);
  }
}