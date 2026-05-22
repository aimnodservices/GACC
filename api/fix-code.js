export default async function handler(req, res) {
    // Handle CORS
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
        return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables' });
    }
    
    try {
        // ✅ LATEST WORKING MODEL - gemini-1.5-pro (stable)
        // Agar ye na chale to try gemini-1.5-flash
        const model = 'gemini-1.5-pro'; // ya 'gemini-1.5-flash'
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `You are a code debugger. Analyze this code and return ONLY valid JSON. No markdown, no extra text.

CODE:
${code}

RETURN JSON FORMAT:
{
  "errors": [
    {
      "type": "Error Type",
      "description": "What is wrong",
      "line": "line number"
    }
  ],
  "fixedCode": "Complete corrected code"
}

RULES:
- Fix all bugs (syntax, logic, off-by-one, undefined variables)
- If no errors, return empty array and original code
- Return ONLY JSON, nothing else`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 4096
                }
            })
        });
        
        const responseText = await response.text();
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorData = JSON.parse(responseText);
                errorMsg = errorData.error?.message || errorMsg;
            } catch(e) {}
            throw new Error(errorMsg);
        }
        
        const data = JSON.parse(responseText);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error('Empty response from Gemini');
        }
        
        // Extract JSON
        let jsonText = text;
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            jsonText = text.substring(jsonStart, jsonEnd);
        }
        
        const result = JSON.parse(jsonText);
        
        if (!result.errors) result.errors = [];
        if (!result.fixedCode) result.fixedCode = code;
        
        return res.status(200).json(result);
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: error.message,
            tip: "Make sure your Gemini API key is valid and has access to generative models"
        });
    }
}
