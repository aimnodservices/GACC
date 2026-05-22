export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
    }
    
    // Try multiple models in sequence
    const models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'];
    let lastError = null;
    
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `Return JSON only: {"errors":[],"fixedCode":"${code.replace(/"/g, '\\"')}"}` }]
                    }]
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"errors":[],"fixedCode":""}';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { errors: [], fixedCode: code };
                return res.status(200).json(result);
            }
        } catch (err) {
            lastError = err;
        }
    }
    
    return res.status(500).json({ 
        error: 'No working model found. Please check your Gemini API key.',
        details: lastError?.message 
    });
}
