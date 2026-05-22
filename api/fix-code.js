export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { code } = req.body;
    if (!code || code.trim() === '') {
        return res.status(400).json({ error: 'No code provided' });
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY not set in Vercel environment variables',
            fix: 'Go to Vercel Dashboard → Settings → Environment Variables → Add GEMINI_API_KEY'
        });
    }
    
    try {
        // ✅ GOOGLE'S LATEST API ENDPOINT (December 2024)
        // Using gemini-1.5-flash-002 (latest stable)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `You are an expert code debugger. Fix all bugs in this code and return ONLY valid JSON.

Code to fix:
${code}

Return EXACTLY this JSON format (no other text):
{
  "errors": [
    {
      "type": "Bug Type",
      "description": "What's wrong",
      "line": "line number"
    }
  ],
  "fixedCode": "The complete corrected code"
}

If no errors, return empty errors array and original code.`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('API Error:', data);
            throw new Error(data.error?.message || 'API request failed');
        }
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Empty response from Gemini');
        }
        
        // Extract JSON from response
        let jsonStr = text;
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            jsonStr = text.substring(jsonStart, jsonEnd);
        }
        
        const result = JSON.parse(jsonStr);
        
        // Ensure proper structure
        if (!result.errors) result.errors = [];
        if (!result.fixedCode) result.fixedCode = code;
        
        return res.status(200).json(result);
        
    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ 
            error: error.message,
            help: '1. Get new API key from https://aistudio.google.com/apikey\n2. Add it to Vercel environment variables\n3. Redeploy'
        });
    }
}
