export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { code } = req.body;
    
    if (!code || code.trim() === '') {
        return res.status(400).json({ error: 'No code provided' });
    }
    
    // Get API key from environment variable
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not set in environment variables');
        return res.status(500).json({ error: 'API key not configured. Please add GEMINI_API_KEY to Vercel environment variables.' });
    }
    
    try {
        const prompt = `You are an expert code debugger and bug fixer. Analyze the code below and return ONLY valid JSON (no other text, no markdown).

CODE:
${code}

Return JSON in this exact format:
{
  "errors": [
    {
      "type": "Syntax Error / Logic Error / Runtime Error",
      "description": "Clear description of what's wrong",
      "line": "approximate line number or 'N/A'"
    }
  ],
  "fixedCode": "The complete corrected code with all bugs fixed"
}

RULES:
- If no errors, return empty errors array and original code as fixedCode
- Fix ALL bugs: syntax, logic, off-by-one, undefined variables, type errors
- Keep the same programming language and original functionality
- Return ONLY valid JSON, nothing else`;
        
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 4096
                    }
                })
            }
        );
        
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
        
        // Extract JSON from response
        let jsonText = text;
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
            jsonText = text.substring(jsonStart, jsonEnd);
        }
        
        const result = JSON.parse(jsonText);
        
        // Validate result structure
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
