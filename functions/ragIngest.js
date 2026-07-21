// Firebase Cloud Function / Node Worker: ragIngest.js
// Handles PDF text parsing, semantic chunking, Gemini embedding extraction,
// and saves vectors into Firestore for localized citizen RAG queries.

const {getApps, initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const https = require('https');

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

const GEMINI_KEY = process.env.GEMINI_KEY || '';

/**
 * Extracts vector embedding for a given text chunk from the Gemini Embedding model.
 * @param {string} textChunk 
 * @returns {Promise<Array<number>>} Vector array
 */
async function getGeminiEmbedding(textChunk) {
  if (!GEMINI_KEY) {
    throw new Error("Missing GEMINI_KEY environment variable.");
  }

  const requestBody = JSON.stringify({
    model: "models/text-embedding-004",
    content: { parts: [{ text: textChunk }] }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.embedding && parsed.embedding.values) {
            resolve(parsed.embedding.values);
          } else {
            reject(new Error("Failed to extract embedding from response: " + data));
          }
        } catch (e) {
          reject(new Error("JSON Parse Error: " + data));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

/**
 * Splits text into semantic chunks with overlap.
 * @param {string} text 
 * @param {number} limit 
 * @param {number} overlap 
 */
function chunkText(text, limit = 800, overlap = 150) {
  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + limit);
    chunks.push(chunkWords.join(' '));
    i += (limit - overlap);
  }
  return chunks;
}

/**
 * Ingests a raw document, chunks it, extracts vectors, and stores them in Firestore.
 * @param {string} docId 
 * @param {string} corpusId 
 * @param {string} rawText 
 * @param {object} metadata 
 */
async function ingestDocument(docId, corpusId, rawText, metadata = {}) {
  console.log(`[RAG] Ingesting Document ID: ${docId} into Corpus: ${corpusId}`);
  const chunks = chunkText(rawText);

  for (let idx = 0; idx < chunks.length; idx++) {
    const textChunk = chunks[idx];
    try {
      // 1. Fetch 768-dimension vector embedding from Gemini
      const vector = await getGeminiEmbedding(textChunk);

      // 2. Save vector chunk with metadata to Firestore collection
      const chunkRef = db.collection('knowledgeChunks').doc(`${docId}_chunk_${idx}`);
      await chunkRef.set({
        docId,
        corpusId,
        chunkIndex: idx,
        content: textChunk,
        embedding: FieldValue.vector(vector), // Firestore Native Vector Type
        metadata: {
          ...metadata,
          ingestedAt: FieldValue.serverTimestamp()
        }
      });
      console.log(`[RAG] Successfully stored chunk ${idx}/${chunks.length - 1}`);
    } catch (err) {
      console.error(`[RAG ERROR] Failed processing chunk ${idx}:`, err);
    }
  }
}

module.exports = { ingestDocument, getGeminiEmbedding };
