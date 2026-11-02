/**
 * Test endpoint for fixed stateful LLM with proper JSON schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { statefulMedicalLLM } from '@/lib/stateful-llm-interface';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('Testing stateful LLM with message:', message);

    // Test the stateful LLM
    const response = await statefulMedicalLLM.processMessage(message);

    console.log('Stateful LLM response:', JSON.stringify(response, null, 2));

    return NextResponse.json({
      success: true,
      response: response,
      emergencyDetected: response.updated_memory.emergencyFlags.length > 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test stateful error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
