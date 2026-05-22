export default async function handler(req, res) {
    // Enable CORS
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
        console.error('GEMINI_API_KEY not set');
        return res.status(500).json({ error: 'API key not configured. Please add GEMINI_API_KEY to Vercel environment variables.' });
    }
    
    try {
        // ✅ CORRECT MODEL NAME - gemini-1.5-pro (not flash)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `You are an expert code debugger and bug fixer. Analyze the code below and return ONLY valid JSON (no markdown, no extra text).

CODE TO ANALYZE:
${code}

Return EXACTLY this JSON format:
{
  "errors": [
    {
      "type": "Syntax Error OR Logic Error OR Runtime Error",
      "description": "Clear explanation of the bug",
      "line": "approximate line number"
    }
  ],
  "fixedCode": "The complete corrected code with ALL bugs fixed"
}

RULES:
- Fix ALL bugs: syntax errors, logic errors, off-by-one errors, undefined variables, type errors
- Keep the same programming language and functionality
- If no errors, return empty errors array and original code as fixedCode
- Return ONLY valid JSON, nothing before or after`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: prompt 
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 4096
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            throw new Error(errorData.error?.message || 'Gemini API request failed');
        }
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error('Empty response from Gemini');
        }
        
        console.log('Raw response:', text);
        
        // Extract JSON from response
        let jsonText = text.trim();
        const jsonStart = jsonText.indexOf('{');
        const jsonEnd = jsonText.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            jsonText = jsonText.substring(jsonStart, jsonEnd);
        }
        
        const result = JSON.parse(jsonText);
        
        // Validate and ensure proper structure
        if (!result.errors) result.errors = [];
        if (!result.fixedCode) result.fixedCode = code;
        
        return res.status(200).json(result);
        
    } catch (error) {
        console.error('Error in fix-code handler:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error',
            details: 'Check Vercel logs for more information'
        });
    }
}
