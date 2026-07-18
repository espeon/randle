import { useEffect, useState, type ReactNode } from "react";
import {
  fetchTodayLeaderboard,
  fetchAllTimeLeaderboard,
  fetchPals,
  parseBadges,
  type TodayEntry,
  type AllTimeEntry,
  type PalsEntry,
} from "@/lib/leaderboard";
import { resolveHandle } from "@/lib/identity";
import { getCurrent } from "@/state/session";
import { BADGE_INFO } from "@/lib/badges";
import { BadgeIcon } from "@/components/badge-icon";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type HandleMap = Record<string, string>;

export default function Leaderboard() {
  const [today, setToday] = useState<TodayEntry[] | null>(null);
  const [allTime, setAllTime] = useState<AllTimeEntry[] | null>(null);
  const [pals, setPals] = useState<PalsEntry[] | null>(null);
  const [palsMeta, setPalsMeta] = useState<{ follows: number; rolled: number } | null>(null);
  const [palsLoading, setPalsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handles, setHandles] = useState<HandleMap>({});
  const me = getCurrent()?.did ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTodayLeaderboard(), fetchAllTimeLeaderboard()])
      .then(([t, a]) => {
        if (cancelled) return;
        setToday(t);
        setAllTime(a);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPals = () => {
    if (!me || palsLoading) return;
    setPalsLoading(true);
    fetchPals(me)
      .then((res) => {
        if (!res) {
          setPals([]);
          setPalsMeta(null);
          return;
        }
        setPals(res.entries);
        setPalsMeta({ follows: res.follows_count, rolled: res.rolled_count });
      })
      .catch(() => {
        setPals([]);
        setPalsMeta(null);
      })
      .finally(() => setPalsLoading(false));
  };

  // Resolve DIDs to handles as data arrives (cached in identity.ts).
  useEffect(() => {
    const dids = new Set<string>();
    today?.forEach((e) => dids.add(e.did));
    allTime?.forEach((e) => dids.add(e.did));
    pals?.forEach((e) => dids.add(e.did));
    if (dids.size === 0) return;

    let cancelled = false;
    for (const did of dids) {
      resolveHandle(did).then((h) => {
        if (cancelled || h === null) return;
        setHandles((prev) => (prev[did] ? prev : { ...prev, [did]: h }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [today, allTime]);

  const display = (did: string): string => handles[did] ?? shortDid(did);

  if (error) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-destructive">Couldn't load leaderboard</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>Top rollers, ranked by EP.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="today">
          <TabsList className="mb-4">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="all-time">All-Time</TabsTrigger>
            <TabsTrigger value="pals" onClick={loadPals}>Pals</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {today === null ? (
              <Empty>Loading…</Empty>
            ) : today.length === 0 ? (
              <Empty>No rolls yet today.</Empty>
            ) : (
              <TodayTable entries={today} me={me} display={display} />
            )}
          </TabsContent>

          <TabsContent value="all-time">
            {allTime === null ? (
              <Empty>Loading…</Empty>
            ) : allTime.length === 0 ? (
              <Empty>No data yet.</Empty>
            ) : (
              <AllTimeTable entries={allTime} me={me} display={display} />
            )}
          </TabsContent>

          <TabsContent value="pals">
            {!me ? (
              <Empty>Log in to see how your friends are doing.</Empty>
            ) : palsLoading ? (
              <Empty>Loading your pals… (fetching follows)</Empty>
            ) : pals === null ? (
              <Empty>Click the Pals tab to load your friends' rolls.</Empty>
            ) : pals.length === 0 ? (
              <Empty>
                None of your follows have rolled today.
                {palsMeta && palsMeta.follows > 0
                  ? ` (${palsMeta.rolled}/${palsMeta.follows} follows, no rolls yet)`
                  : " Follow some people on Bluesky to start a pals leaderboard!"}
              </Empty>
            ) : (
              <>
                {palsMeta && palsMeta.rolled < palsMeta.follows && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {palsMeta.rolled}/{palsMeta.follows} of your follows rolled today
                  </p>
                )}
                <PalsTable entries={pals} me={me} display={display} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function TodayTable({
  entries,
  me,
  display,
}: {
  entries: TodayEntry[];
  me: string | null;
  display: (did: string) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Number</TableHead>
          <TableHead className="text-right">EP</TableHead>
          <TableHead>Badges</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, i) => (
          <TableRow key={e.did} className={me === e.did ? "bg-muted/40" : undefined}>
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="font-medium">{display(e.did)}</TableCell>
            <TableCell className="font-mono tabular-nums">{e.canonical_number}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{e.ep}</TableCell>
            <TableCell>
              <TooltipProvider>
                <div className="flex flex-wrap gap-1.5">
                  {parseBadges(e.badges).map((id) => (
                    <Tooltip key={id}>
                      <TooltipTrigger render={
                        <span aria-label={BADGE_INFO[id]?.name ?? id} />
                      }>
                        <BadgeIcon
                          id={id}
                          emoji={BADGE_INFO[id]?.icon ?? "❓"}
                          rarity={BADGE_INFO[id]?.rarity}
                          size={18}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="font-semibold">{BADGE_INFO[id]?.name ?? id}</span>
                        {BADGE_INFO[id]?.desc && (
                          <span className="text-muted-foreground"> — {BADGE_INFO[id].desc}</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AllTimeTable({
  entries,
  me,
  display,
}: {
  entries: AllTimeEntry[];
  me: string | null;
  display: (did: string) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Total EP</TableHead>
          <TableHead className="text-right">Streak</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, i) => (
          <TableRow key={e.did} className={me === e.did ? "bg-muted/40" : undefined}>
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="font-medium">{display(e.did)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{e.total_ep}</TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm tabular-nums text-foreground">
                {e.current_streak > 0 ? `${e.current_streak}🔥` : "—"}
              </span>
              {e.longest_streak > e.current_streak && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (best: {e.longest_streak})
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function PalsTable({
  entries,
  me,
  display,
}: {
  entries: PalsEntry[];
  me: string | null;
  display: (did: string) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Number</TableHead>
          <TableHead className="text-right">EP</TableHead>
          <TableHead>Badges</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, i) => (
          <TableRow key={e.did} className={me === e.did ? "bg-muted/40" : undefined}>
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="font-medium">{display(e.did)}</TableCell>
            <TableCell className="font-mono tabular-nums">{e.canonical_number}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{e.ep}</TableCell>
            <TableCell>
              <TooltipProvider>
                <div className="flex flex-wrap gap-1.5">
                  {parseBadges(e.badges).map((id) => (
                    <Tooltip key={id}>
                      <TooltipTrigger render={
                        <span aria-label={BADGE_INFO[id]?.name ?? id} />
                      }>
                        <BadgeIcon
                          id={id}
                          emoji={BADGE_INFO[id]?.icon ?? "❓"}
                          rarity={BADGE_INFO[id]?.rarity}
                          size={18}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="font-semibold">{BADGE_INFO[id]?.name ?? id}</span>
                        {BADGE_INFO[id]?.desc && (
                          <span className="text-muted-foreground"> — {BADGE_INFO[id].desc}</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Fallback when a handle can't be resolved: did:plc:abcdef… -> did:plc:abcd…
function shortDid(did: string): string {
  return did.length <= 16 ? did : did.slice(0, 13) + "…";
}
