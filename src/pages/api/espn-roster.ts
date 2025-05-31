import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId, espn_s2, SWID } = req.query;

  if (!leagueId || typeof leagueId !== 'string') {
    return res.status(400).json({ error: 'League ID is required' });
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; fantasy-app/1.0)',
    };

    // Add authentication cookies if provided
    if (espn_s2 && SWID && typeof espn_s2 === 'string' && typeof SWID === 'string') {
      headers['Cookie'] = `espn_s2=${espn_s2}; SWID=${SWID}`;
    }

    const response = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/2024/segments/0/leagues/${leagueId}?view=mRoster`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ESPN roster: ${response.status}`);
    }

    const data = await response.json();
    
    // Set appropriate headers for JSON response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // Cache for 5 minutes
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching ESPN roster:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}