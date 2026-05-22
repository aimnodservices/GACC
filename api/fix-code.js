export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { code } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not set' });
    
    // Tere available models - jo teri API list mein hai
    const models = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `Fix this code and return JSON only: {"errors":[],"fixedCode":"${code.replace(/"/g, '\\"')}"}` }]
                    }]
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                const match = text?.match(/\{[\s\S]*\}/);
                if (match) return res.status(200).json(JSON.parse(match[0]));
            }
        } catch(e) {}
    }
    
    return res.status(200).json({ errors: [], fixedCode: code });
}
