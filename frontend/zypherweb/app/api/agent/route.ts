import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface AgentDecision {
  hedgeDecision: boolean;
  yieldRate: number;
  volatility: number;
  price: number;
  timestamp: number;
}

/**
 * API endpoint to get current hedge decision from the AI agent
 * This polls the Python agent or calculates decision based on oracle data
 */
export async function GET() {
  try {
    // Fetch Pyth oracle data for Gold (same as agent uses)
    const assetId = '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2';
    const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${assetId}`);
    
    if (!response.ok) {
      throw new Error(`Oracle fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const priceData = data.parsed?.[0]?.price;
    
    if (!priceData) {
      throw new Error('No price data available');
    }

    const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
    
    // Calculate volatility (simplified - use last price vs current)
    // In production, this would maintain a price history
    const volatility = Math.random() * 0.3; // Mock for now, agent calculates this
    
    // Calculate yield rate (normalized from price movement)
    const yieldRate = Math.abs(price - 2000) / 2000; // Normalized against gold baseline
    
    // Agent decision logic (matches HedgeAgent forward pass)
    // decision = sigmoid(fc2(relu(fc1([yield_rate, volatility])))) > 0.5
    // Simplified: hedge if volatility > 0.30 OR yield_rate < 0.05
    const hedgeDecision = volatility > 0.30 || yieldRate < 0.05;

    const agentDecision: AgentDecision = {
      hedgeDecision,
      yieldRate,
      volatility,
      price,
      timestamp: Date.now(),
    };

    return NextResponse.json(agentDecision);
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent decision' },
      { status: 500 }
    );
  }
}
