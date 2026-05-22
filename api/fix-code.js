export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }
    
    // Get API key from environment
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY not set in Vercel' 
        });
    }
    
    try {
        // ✅ GOOGLE'S OFFICIAL WORKING ENDPOINT - December 2024
        // Using correct v1beta API with gemini-pro
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        
        const systemPrompt = `You are a code debugger. Fix all bugs in the code and return JSON only.`;
        const userPrompt = `Return ONLY this JSON format: {"errors":[{"type":"error type","description":"what's wrong","line":"line number"}],"fixedCode":"complete fixed code"}\n\nCode:\n${code}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: systemPrompt }]
                    },
                    {
                        parts: [{ text: userPrompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                }
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('API Error:', JSON.stringify(data));
            throw new Error(data.error?.message || 'API request failed');
        }
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error('Empty response');
        }
        
        // Extract JSON
        let jsonStr = text;
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}') + 1;
        if (start !== -1 && end > start) {
            jsonStr = text.substring(start, end);
        }
        
        const result = JSON.parse(jsonStr);
        
        // Ensure structure
        if (!result.errors) result.errors = [];
        if (!result.fixedCode) result.fixedCode = code;
        
        return res.status(200).json(result);
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: error.message,
            fix: 'Get new API key from https://aistudio.google.com/apikey'
        });
    }
}
