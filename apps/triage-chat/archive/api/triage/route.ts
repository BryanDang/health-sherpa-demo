import { NextRequest, NextResponse } from 'next/server';
import { TwoStageTriageSystem } from '@/lib/two-stage-triage-system';
import { MedicalTriageMCPIntegration } from '@/mcp/medical-triage/mcp-integration';

const apiKey = process.env.GOOGLE_GENAI_API_KEY;

export async function POST(request: NextRequest) {
  let message: string = '';
  
  try {
    const { message: userMessage, conversationHistory = [], previousGatheredInfo, requestCitations = false } = await request.json();
    message = userMessage;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if AI is available
    if (!apiKey || apiKey === 'test_key_placeholder') {
      return NextResponse.json(
        { 
          error: 'AI triage service is currently unavailable',
          details: 'Google Generative AI is not configured',
          isEmergency: false,
          nextSteps: ['For medical emergencies, call 911', 'Contact your healthcare provider directly']
        },
        { status: 503 }
      );
    }

    console.log('Using model: gemini-2.0-flash');

    // Initialize two-stage triage system
    const triageSystem = new TwoStageTriageSystem(apiKey);
    
    // Perform complete two-stage triage
    const triageResult = await triageSystem.performCompleteTriage(
      message,
      conversationHistory,
      previousGatheredInfo,
      requestCitations
    );
    
    // Handle emergency cases first
    if (triageResult.isEmergency) {
      return NextResponse.json({
        response: triageResult.finalResponse,
        careLevel: 'emergency',
        isEmergency: true,
        reasoning: {
          symptomsAnalyzed: triageResult.stage1.gatheredInformation.symptoms,
          redFlags: [triageResult.stage1.emergencyReason || 'Emergency condition detected'],
          careLevelJustification: 'Emergency symptoms require immediate medical attention',
          timeframe: 'Immediately',
          nextSteps: ['Call 911 immediately', 'Go to nearest emergency room']
        },
        stageDetails: {
          stage1: triageResult.stage1,
          stage2: triageResult.stage2
        },
        timestamp: new Date().toISOString()
      });
    }

    // Handle if more information is needed (pending complete assessment)
    if (triageResult.careLevel === 'pending') {
      return NextResponse.json({
        response: triageResult.finalResponse,
        careLevel: null,
        isEmergency: false,
        needsMoreInfo: true,
        stageDetails: {
          stage1: triageResult.stage1,
          stage2: triageResult.stage2
        },
        timestamp: new Date().toISOString()
      });
    }

    // Handle provider search if location mentioned
    let providers = [];
    if (triageResult.stage1?.gatheredInformation?.location) {
      try {
        // Convert location to coordinates using geocoding API
        const geocodeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/geocode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zipCode: triageResult.stage1.gatheredInformation.location })
        });
        
        if (geocodeResponse.ok) {
          const coordinates = await geocodeResponse.json();
          
          // Search for providers using Maps API
          const mapsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/maps`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              providerType: triageResult.careLevel === 'urgent' ? 'urgent_care' : 'hospital'
            })
          });
          
          if (mapsResponse.ok) {
            const mapsData = await mapsResponse.json();
            providers = mapsData.providers || [];
          }
        }
      } catch (error) {
        console.error('Provider search error:', error);
      }
    }
    
    // Enhance response with provider information if available
    let enhancedResponse = triageResult.finalResponse;
    if (providers.length > 0) {
      enhancedResponse += `\n\nNearby healthcare facilities I found for you:\n${providers.slice(0,3).map(p => `• ${p.name} - ${p.address} - ${p.phone || 'Phone not available'}`).join('\n')}`;
    }

    // Return complete triage response
    return NextResponse.json({
      response: enhancedResponse,
      careLevel: triageResult.careLevel,
      isEmergency: triageResult.isEmergency,
      reasoning: {
        symptomsAnalyzed: triageResult.stage1.gatheredInformation.symptoms,
        redFlags: triageResult.stage2?.medicalAssessment?.redFlags || [],
        careLevelJustification: triageResult.stage2?.triageDecision?.clinicalReasoning?.join('. ') || 'Assessment in progress',
        timeframe: triageResult.stage2?.triageDecision?.timeframe || 'As recommended',
        nextSteps: triageResult.stage2?.recommendations?.immediateActions || []
      },
      stageDetails: {
        stage1: triageResult.stage1,
        stage2: triageResult.stage2
      },
      providers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Two-stage triage system error:', error);
    
    // Emergency fallback - if original message mentions breathing, treat as emergency
    const originalMessage = message.toLowerCase();
    if (originalMessage.includes('breath') || originalMessage.includes('breating') || originalMessage.includes('trouble breathing')) {
      return NextResponse.json({
        response: "Based on what you're describing about breathing difficulties, this sounds like a medical emergency. Please call 911 or go to your nearest emergency room immediately.",
        careLevel: 'emergency',
        isEmergency: true,
        reasoning: {
          symptomsAnalyzed: ['breathing difficulty'],
          redFlags: ['Breathing problems detected'],
          careLevelJustification: 'Any breathing difficulty requires immediate medical evaluation',
          timeframe: 'Immediately',
          nextSteps: ['Call 911 immediately', 'Go to nearest emergency room']
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Safe fallback response
    return NextResponse.json({
      response: "I understand you have health concerns, but I'm experiencing a technical issue. For your safety, please contact a healthcare provider directly. If this is an emergency, call 911 immediately.",
      careLevel: 'primary',
      isEmergency: false,
      reasoning: {
        symptomsAnalyzed: [message],
        redFlags: [],
        careLevelJustification: 'System error - manual evaluation recommended',
        timeframe: 'As soon as possible',
        nextSteps: ['Contact healthcare provider', 'Call 911 if emergency']
      },
      timestamp: new Date().toISOString()
    });
  }
}

