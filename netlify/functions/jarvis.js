// Serverless JARVIS brain — upgraded duplicate netlify function.
// Integrates Gemini Flash, fetches local RAG knowledge summaries, 
// and matches query patterns to append context from Firestore or fallbacks.

const https = require('https');

// Local fallback knowledge chunks for the RAG system to guarantee answers
const LOCAL_RAG_KNOWLEDGE = [
  {
    topic: "proposals and voting",
    text: "G.A.I.G.S. utilizes a bottom-up governance hierarchy: Global -> Country -> City -> Society. Proposals are submitted at the society center (e.g. Masjid/Church/Community Hall). Votes require a quorum and a simple majority to pass. Crucially, a 33% citizen veto threshold instantly blocks any proposal from execution, neutralizing centralized lobby groups."
  },
  {
    topic: "wallet and ownership shares",
    text: "The GAIGS platform account is an auditable application ledger. It does not generate or custody crypto private keys. Real PKR or crypto settlement must remain disabled until a licensed payment provider or user-controlled wallet integration, KYC/AML review, reconciliation, dispute handling and jurisdiction-specific legal approval are complete. Proposed rewards or ownership allocations are governance concepts, not issued financial assets."
  },
  {
    topic: "science game and simulation",
    text: "The Science Game utilizes real physics engines (Three.js and Cannon-es) to simulate real-world challenges such as water arsenic filtration, street thermal design, and orbital physics. Citizens propose solutions; high-performing ones earn points, NDC bounties, and NDS contributor shares, turning attention into actual research pipelines."
  },
  {
    topic: "disaster relief transparent ledgers",
    text: "A verified disaster alert can open a dedicated relief-ledger workspace. Real donations require a regulated payment provider. Releases should link an approved purpose, itemized receipt, field evidence and independent verifier while protecting beneficiary privacy."
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }

  const GEMINI_KEY = process.env.GEMINI_KEY;
  if (!GEMINI_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_KEY environment variable not configured.' }) };
  }

  const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';

  try {
    const body = JSON.parse(event.body || '{}');
    const userQuery = body.contents ? body.contents[body.contents.length - 1].parts[0].text : '';

    if (process.env.GAIGS_JARVIS_BRIDGE_URL && process.env.GAIGS_JARVIS_BRIDGE_TOKEN && body.gaigs) {
      try {
        const bridgeResponse = await fetch(process.env.GAIGS_JARVIS_BRIDGE_URL.replace(/\/$/, '') + '/v1/ask', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GAIGS_JARVIS_BRIDGE_TOKEN},
          body: JSON.stringify({prompt: userQuery, uid: String(body.gaigs.uid || 'anonymous'), scope: body.gaigs.scope || 'personal', context: body.gaigs.context || {}})
        });
        if (bridgeResponse.ok) {
          const bridge = await bridgeResponse.json();
          return {statusCode: 200, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify({candidates:[{content:{parts:[{text:bridge.answer}]}}], auditId:bridge.auditId})};
        }
      } catch (bridgeError) {
        console.warn('[JARVIS] Safe bridge unavailable; using serverless AI fallback.');
      }
    }

    // 1. Perform a simple keyword-based RAG matching from local or remote Firestore
    let retrievedContext = "";
    
    // Check if we can talk to Firestore REST API
    if (FIREBASE_PROJECT_ID) {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/knowledgeChunks?limit=10`;
        const firestoreResponse = await new Promise((resolve, reject) => {
          https.get(firestoreUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        
        if (firestoreResponse.documents && firestoreResponse.documents.length > 0) {
          // Filter matching chunks by keyword
          const matchedDocs = firestoreResponse.documents.filter(doc => {
            const content = doc.fields.content?.stringValue || '';
            return content.toLowerCase().split(/\s+/).some(word => userQuery.toLowerCase().includes(word));
          });
          if (matchedDocs.length > 0) {
            retrievedContext = matchedDocs.slice(0, 3).map(doc => doc.fields.content.stringValue).join('\n\n');
            console.log("[RAG] Retrieved context from Firestore REST API successfully.");
          }
        }
      } catch (err) {
        console.warn("[RAG WARNING] Failed to query Firestore REST API, using local RAG fallback:", err);
      }
    }

    // Fallback to local RAG knowledge matching if no context was found from Firestore
    if (!retrievedContext && userQuery) {
      const match = LOCAL_RAG_KNOWLEDGE.find(k => 
        userQuery.toLowerCase().includes(k.topic.split(' ')[0]) || 
        userQuery.toLowerCase().includes(k.topic.split(' ').pop())
      );
      if (match) {
        retrievedContext = match.text;
        console.log("[RAG] Matched local RAG context topic: " + match.topic);
      }
    }

    // 2. Format query and append RAG Context to system instruction if found
    let systemInstruction = body.system_instruction || { parts: [{ text: "You are JARVIS, a helpful AI assistant." }] };
    if (retrievedContext) {
      const originalInstruction = systemInstruction.parts[0].text;
      systemInstruction = {
        parts: [{
          text: `${originalInstruction}\n\n[RAG SEARCH RESULTS - USE THIS CONTEXT TO ANSWER ACCURATELY]:\n${retrievedContext}`
        }]
      };
    }

    // 3. Make POST request to Gemini API
    const requestBody = JSON.stringify({
      system_instruction: systemInstruction,
      contents: (body.contents || []).slice(-12)
    });

    const resultData = await new Promise((resolve, reject) => {
      const gReq = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, (gRes) => {
        let chunkData = '';
        gRes.on('data', chunk => chunkData += chunk);
        gRes.on('end', () => {
          try {
            resolve(JSON.parse(chunkData));
          } catch (e) {
            reject(new Error('JSON parse error from Gemini API: ' + chunkData));
          }
        });
      });

      gReq.on('error', reject);
      gReq.write(requestBody);
      gReq.end();
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(resultData)
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: String(e).slice(0, 150) })
    };
  }
};
