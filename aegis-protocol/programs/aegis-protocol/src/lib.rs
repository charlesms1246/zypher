use anchor_lang::prelude::*;

declare_id!("55XeLRYQTn24sEDvTxM2UfDQp8z8oZ7mA8DSkFmD2kzN");

#[program]
pub mod aegis_protocol {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
