export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
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
        return res.status(500).json({ error: 'API key not configured. Please add GEMINI_API_KEY to Vercel environment variables.' });
    }
    
    try {
        const prompt = `You are an expert code debugger. Analyze the code below and return ONLY valid JSON.

CODE:
${code}

Return JSON:
{
  "errors": [
    {
      "type": "Error Type",
      "description": "What's wrong",
      "line": "line number"
    }
  ],
  "fixedCode": "Complete fixed code"
}

Rules:
- Fix ALL bugs: syntax, logic, off-by-one, undefined variables
- If no errors, return empty errors array and original code
- Return ONLY valid JSON, nothing else`;
        
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 4096
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Gemini API failed');
        }
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error('Empty response');
        
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
        return res.status(500).json({ error: error.message });
    }
}
