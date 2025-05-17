// src/pages/api/ingest.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabaseServerClient';

// Ensure environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }  

// Initialize Supabase with service role (server-only)
const supabase = supabaseServer(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Game = {
  teams: {
    home: { team: { id: number } };
    away: { team: { id: number } };
  };
  probablePitchers?: {
    home?: { id: number; fullName: string };
    away?: { id: number; fullName: string };
  };
};

type PlayerDetailsResponse = {
  people: Array<{
    id: number;
    fullName: string;
    batSide?: { code: string };
    pitchHand?: { code: string };
  }>;
};

// simple fetch with retry
const fetchWithRetry = async (url: string, retries = 3) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      console.error(`Fetch ${url} (attempt ${i}) failed:`, err);
      if (i === retries) throw err;
    }
  }
};

const upsertWithRetry = async (data: any[], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await supabase.from('daily_matchups').upsert(data);
      return;
    } catch (err) {
      console.error(`Upsert attempt ${attempt} failed:`, err);
      if (attempt === retries) throw err;
    }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1. Determine date
    const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
    const today = new Date().toISOString().slice(0, 10);
    const gameDate = dateParam || today;

    // 2. Fetch schedule + probables
    const sched = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/schedule?date=${gameDate}&hydrate=probablePitchers`
    );
    const games: Game[] = sched.dates?.[0]?.games || [];
    if (!games.length) return res.status(200).json({ success: true, count: 0 });

    // 3. Roster cache & collect IDs
    const teamIds = Array.from(
      new Set(games.flatMap(g => [g.teams.home.team.id, g.teams.away.team.id]))
    );
    const rosters: Record<number, any[]> = {};
    await Promise.all(
      teamIds.map(async (tid) => {
        const j = await fetchWithRetry(
          `https://statsapi.mlb.com/api/v1/teams/${tid}/roster?rosterType=active`
        );
        rosters[tid] = j.roster;
      })
    );

    // 4. Collect all player IDs for splits & handedness lookups
    const batterIds: number[] = [];
    const pitcherIds: number[] = [];
    const lookupPairs: Array<{ pit: number; bat: number; batName: string; pitName: string }> = [];

    for (const g of games) {
      const homePid = g.probablePitchers?.home?.id;
      const awayPid = g.probablePitchers?.away?.id;
      if (!homePid || !awayPid) continue;

      rosters[g.teams.home.team.id]?.forEach(p => {
        batterIds.push(p.person.id);
        pitcherIds.push(awayPid);
        lookupPairs.push({
          pit: awayPid,
          bat: p.person.id,
          batName: p.person.fullName,
          pitName: g.probablePitchers!.away!.fullName
        });
      });
      rosters[g.teams.away.team.id]?.forEach(p => {
        batterIds.push(p.person.id);
        pitcherIds.push(homePid);
        lookupPairs.push({
          pit: homePid,
          bat: p.person.id,
          batName: p.person.fullName,
          pitName: g.probablePitchers!.home!.fullName
        });
      });
    }

    const uniquePlayerIds = Array.from(new Set([...batterIds, ...pitcherIds]));

    console.log(`Processing ${games.length} games for date ${gameDate}`);
    console.log(`Fetched ${uniquePlayerIds.length} unique player IDs`);

    // 5. Fetch all splits in one query
    const { data: allSplits } = await supabase
      .from('player_splits')
      .select('player_id, player_type, vs_handedness, xwoba')
      .in('player_id', uniquePlayerIds)

    // 6. Build a map for quick lookup: key = `${type}:${id}|${hand}`
    const splitMap = new Map<string, number>();
    allSplits?.forEach(s => {
      splitMap.set(`${s.player_type}:${s.player_id}|${s.vs_handedness}`, s.xwoba);
    });

    // 7. Fetch handedness for all needed players
    const handMaps = { bat: new Map<number, string>(), pit: new Map<number, string>() };
    const playerDetails = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/people?personIds=${uniquePlayerIds.join(',')}`
    );
    playerDetails.people.forEach(person => {
      if (person.batSide?.code) handMaps.bat.set(person.id, person.batSide.code);
      if (person.pitchHand?.code) handMaps.pit.set(person.id, person.pitchHand.code);
    });

    // 8. Compute upserts
    const upserts = lookupPairs.reduce<any[]>((acc, { pit, bat, batName, pitName }) => {
      const batSide = handMaps.bat.get(bat);
      const pitSide = handMaps.pit.get(pit);
      if (!batSide || !pitSide) return acc;

      const pitXw = splitMap.get(`pitcher:${pit}|${batSide}`);
      const batXw = splitMap.get(`batter:${bat}|${pitSide}`);
      if (pitXw != null && batXw != null) {
        acc.push({
          game_date: gameDate,
          batter_id: bat,
          pitcher_id: pit,
          avg_xwoba: (pitXw + batXw) / 2,
          batter_name: batName,
          pitcher_name: pitName,
        });
      }
      return acc;
    }, []);

    console.log(`Upserting ${upserts.length} matchups into the database`);

    // 9. Upsert batched matchups
    if (upserts.length) {
      await upsertWithRetry(upserts);
    }
    if (!upserts.length) {
        console.log('No valid matchups found—nothing to upsert.');
        return res.status(200).json({ success: true, count: 0 });
    }

    return res.status(200).json({ success: true, count: upserts.length });
  } catch (err) {
    console.error('Ingest error:', err);
    return res.status(500).json({
      error: 'Ingestion failed',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
