import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useGetStrategies,
  useGetVotes,
  getGetStrategiesQueryKey,
  getGetVotesQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function SignalsScreen() {
  const colors = useColors();
  const c = colors as any;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"strategies" | "votes">("strategies");
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: stratData, isLoading: stratLoading, refetch: refetchStrat } = useGetStrategies({
    query: {
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
      queryKey: getGetStrategiesQueryKey(),
      placeholderData: (prev: any) => prev,
      retry: 1,
    },
  });
  const { data: voteData, isLoading: voteLoading, refetch: refetchVotes } = useGetVotes({
    query: {
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
      queryKey: getGetVotesQueryKey(),
      placeholderData: (prev: any) => prev,
      retry: 1,
      enabled: tab === "votes",
    },
  } as any);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchStrat(), tab === "votes" ? refetchVotes() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  };

  const strategies = stratData?.strategies ?? [];
  const votes = (voteData?.results ?? []).sort((a, b) => b.confidence - a.confidence);
  const buySignals = votes.filter((v) => v.decision === "buy");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 34 + 84 : 84 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Signals</Text>

      {/* Tab switcher */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setTab("strategies")}
          style={[styles.tabButton, tab === "strategies" && { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: tab === "strategies" ? colors.primaryForeground : colors.mutedForeground }]}>
            Strategies
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab("votes")}
          style={[styles.tabButton, tab === "votes" && { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: tab === "votes" ? colors.primaryForeground : colors.mutedForeground }]}>
            Live Votes
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Strategy Weights ── */}
      {tab === "strategies" && (
        <>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.infoIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="cpu" size={16} color={colors.primary} />
            </View>
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>Learning Engine</Text>
              <Text style={[styles.infoSub, { color: colors.mutedForeground }]}>
                {stratData?.learningCycles ?? 0} learning cycles · weights auto-adjust from outcomes
              </Text>
            </View>
          </View>

          {stratLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : strategies.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="bar-chart-2" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No strategy data yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Start the bot to begin learning</Text>
            </View>
          ) : (
            strategies.map((strategy) => {
              const weightPct = Math.min(100, (strategy.weight / 2.5) * 100);
              const sigColor =
                strategy.currentSignal === "buy"
                  ? c.success
                  : strategy.currentSignal === "sell"
                  ? colors.destructive
                  : colors.mutedForeground;

              return (
                <View key={strategy.id} style={[styles.stratCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.stratHeader}>
                    <View style={styles.stratLeft}>
                      <Text style={[styles.stratName, { color: colors.foreground }]}>{strategy.name}</Text>
                      <Text style={[styles.stratDesc, { color: colors.mutedForeground }]}>{strategy.description}</Text>
                    </View>
                    <View style={[styles.signalBadge, { backgroundColor: `${sigColor}22` }]}>
                      <Text style={[styles.signalText, { color: sigColor }]}>
                        {strategy.currentSignal.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stratStats}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statVal, { color: colors.primary }]}>{strategy.weight.toFixed(2)}x</Text>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Weight</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statVal, { color: colors.foreground }]}>{strategy.winRate.toFixed(1)}%</Text>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Win Rate</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statVal, { color: colors.foreground }]}>{strategy.totalSignals}</Text>
                      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Signals</Text>
                    </View>
                  </View>

                  <View style={[styles.weightTrack, { backgroundColor: colors.secondary }]}>
                    <View style={[styles.weightFill, { width: `${weightPct}%` as any, backgroundColor: colors.primary }]} />
                  </View>
                  <View style={styles.weightLabels}>
                    <Text style={[styles.weightMin, { color: colors.mutedForeground }]}>0.2x min</Text>
                    <Text style={[styles.weightMax, { color: colors.mutedForeground }]}>2.5x max</Text>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}

      {/* ── Live Votes ── */}
      {tab === "votes" && (
        <>
          {voteLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : votes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="zap" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No signals yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Start the bot to load live votes</Text>
            </View>
          ) : (
            <>
              <View style={[styles.summaryCard, { backgroundColor: `${c.success}18`, borderColor: `${c.success}44` }]}>
                <Feather name="trending-up" size={15} color={c.success} />
                <Text style={[styles.summaryText, { color: c.success }]}>
                  {buySignals.length} buy signal{buySignals.length !== 1 ? "s" : ""} from {votes.length} coins
                </Text>
              </View>

              {votes.map((vote) => {
                const total = vote.buyScore + vote.sellScore + vote.holdScore;
                const buyPct = total > 0 ? (vote.buyScore / total) * 100 : 33;
                const sellPct = total > 0 ? (vote.sellScore / total) * 100 : 33;
                const decColor =
                  vote.decision === "buy"
                    ? c.success
                    : vote.decision === "sell"
                    ? colors.destructive
                    : colors.mutedForeground;

                const borderColor =
                  vote.decision === "buy"
                    ? `${c.success}55`
                    : vote.decision === "sell"
                    ? `${colors.destructive}33`
                    : colors.border;

                return (
                  <View key={vote.symbol} style={[styles.voteCard, { backgroundColor: colors.card, borderColor }]}>
                    <View style={styles.voteHeader}>
                      <View style={styles.voteLeft}>
                        <Text style={[styles.voteSymbol, { color: colors.foreground }]}>{vote.symbol}</Text>
                        <Text style={[styles.voteName, { color: colors.mutedForeground }]}>{vote.name}</Text>
                      </View>
                      <View style={styles.voteRight}>
                        <Text style={[styles.voteDecision, { color: decColor }]}>
                          {vote.decision.toUpperCase()}
                        </Text>
                        <Text style={[styles.voteConf, { color: colors.mutedForeground }]}>
                          {(vote.confidence * 100).toFixed(0)}% conf · {vote.votes.filter((v) => v.vote === "buy").length}/7 buy
                        </Text>
                      </View>
                    </View>

                    {/* Buy/sell bar */}
                    <View style={[styles.voteBar, { backgroundColor: colors.secondary }]}>
                      <View style={[styles.buyBar, { width: `${buyPct}%` as any, backgroundColor: c.success }]} />
                      <View style={[styles.sellBar, { width: `${sellPct}%` as any, backgroundColor: colors.destructive }]} />
                    </View>

                    {/* Strategy pills */}
                    <View style={styles.pills}>
                      {vote.votes.map((v) => {
                        const pillColor =
                          v.vote === "buy" ? c.success : v.vote === "sell" ? colors.destructive : colors.secondary;
                        const pillText = v.vote === "hold" ? colors.mutedForeground : "#000";
                        return (
                          <View
                            key={v.strategyId}
                            style={[styles.pill, { backgroundColor: pillColor }]}
                          >
                            <Text style={[styles.pillText, { color: pillText }]}>
                              {v.strategyName.slice(0, 3).toUpperCase()}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 16 },
  tabRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 16, gap: 4 },
  tabButton: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  infoIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoText: { flex: 1, minWidth: 0 },
  infoTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: "center", gap: 10, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  stratCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  stratHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  stratLeft: { flex: 1, minWidth: 0, marginRight: 10 },
  stratName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  stratDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 16 },
  signalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
  signalText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  stratStats: { flexDirection: "row", alignItems: "center", marginBottom: 14, borderRadius: 10, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 8 },
  statDivider: { width: 1, height: 32 },
  statVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 },
  weightTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  weightFill: { height: "100%", borderRadius: 3 },
  weightLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  weightMin: { fontSize: 10, fontFamily: "Inter_400Regular" },
  weightMax: { fontSize: 10, fontFamily: "Inter_400Regular" },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  summaryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  voteCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  voteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  voteLeft: { flex: 1, minWidth: 0 },
  voteSymbol: { fontSize: 15, fontFamily: "Inter_700Bold" },
  voteName: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  voteRight: { alignItems: "flex-end", flexShrink: 0, marginLeft: 8 },
  voteDecision: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  voteConf: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  voteBar: { height: 6, borderRadius: 3, overflow: "hidden", flexDirection: "row", marginBottom: 10 },
  buyBar: { height: "100%" },
  sellBar: { height: "100%" },
  pills: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 9, fontFamily: "Inter_700Bold" },
});
