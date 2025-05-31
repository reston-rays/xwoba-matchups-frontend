import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leagueId } = req.query;

  if (!leagueId || typeof leagueId !== 'string') {
    return res.status(400).json({ error: 'League ID is required' });
  }

  try {
    const response = await fetch(`https://ottoneu.fangraphs.com/${leagueId}/rosterexport?csv=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; fantasy-app/1.0)',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch roster: ${response.status}`);
    }

    const csvData = await response.text();
    
    // Set appropriate headers for CSV response
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // Cache for 5 minutes
    
    return res.status(200).send(csvData);
  } catch (error) {
    console.error('Error fetching Ottoneu roster:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}