import React from "react";
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
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPortfolio,
  useGetBotStatus,
  useGetSettings,
  getGetPortfolioQueryKey,
  getGetBotStatusQueryKey,
  getGetTradesQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useBot } from "@/contexts/BotContext";
import { TradeCard } from "@/components/TradeCard";

type BalancePoint = { ts: number; balance: number; pnl: number };

function BalanceSparkline({ data, color }: { data: BalancePoint[]; color: string }) {
  if (!data || data.length < 2) return null;
  const W = 300;
  const H = 72;
  const balances = data.map((d) => d.balance);
  const minB = Math.min(...balances);
  const maxB = Math.max(...balances);
  const range = maxB - minB || 0.01;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - 4 - ((d.balance - minB) / range) * (H - 8),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${W},${H} L0,${H} Z`;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Path d={fillPath} fill="url(#balGrad)" />
      <Path d={linePath} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bot = useBot();
  const queryClient = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: portfolio, isLoading: portfolioLoading, refetch: refetchPortfolio } = useGetPortfolio({
    query: {
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
      queryKey: getGetPortfolioQueryKey(),
      placeholderData: (prev: any) => prev,
      retry: 1,
    },
  });
  const { data: botStatus, refetch: refetchBot } = useGetBotStatus({
    query: {
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
      queryKey: getGetBotStatusQueryKey(),
      placeholderData: (prev: any) => prev,
      retry: 1,
    },
  });
  const { data: settings } = useGetSettings({});
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchPortfolio(), refetchBot()]);
    setRefreshing(false);
  };

  const handleBotToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (bot.isRunning) {
      bot.stopBot();
    } else {
      bot.startBot();
    }
  };

  const pnlPositive = (portfolio?.totalPnl ?? 0) >= 0;
  const activeTrades = botStatus?.activeTrades ?? [];
  const isPaper = settings?.mode === "paper";
  const balanceHistory: BalancePoint[] = (portfolio as any)?.balanceHistory ?? [];
  const chartUp = balanceHistory.length > 1
    ? balanceHistory[balanceHistory.length - 1].balance >= balanceHistory[0].balance
    : pnlPositive;
  const chartColor = chartUp ? colors.success : colors.destructive;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: bottomPad + 80 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Binance.US Bot</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Dashboard</Text>
        </View>
        <View style={[styles.modePill, { backgroundColor: isPaper ? `${colors.warning}22` : `${colors.success}22` }]}>
          <View style={[styles.modeDot, { backgroundColor: isPaper ? colors.warning : colors.success }]} />
          <Text style={[styles.modeLabel, { color: isPaper ? colors.warning : colors.success }]}>
            {isPaper ? "PAPER" : "LIVE"}
          </Text>
        </View>
      </View>

      {/* Portfolio Card */}
      <View style={[styles.portfolioCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
          {isPaper ? "Paper Balance" : "USD Balance"}
        </Text>
        {portfolioLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 10 }} />
        ) : (
          <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
            ${(portfolio?.totalBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}

        {/* Balance history sparkline */}
        {balanceHistory.length >= 2 ? (
          <View style={styles.chartWrapper}>
            <BalanceSparkline data={balanceHistory} color={chartColor} />
            <View style={styles.chartLabels}>
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>
                {new Date(balanceHistory[0].ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={[styles.chartLabel, { color: chartColor, fontFamily: "Inter_600SemiBold" }]}>
                {pnlPositive ? "+" : ""}${(portfolio?.totalPnl ?? 0).toFixed(2)} P&L
              </Text>
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>
                {new Date(balanceHistory[balanceHistory.length - 1].ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.chartPlaceholder}>
            <Text style={[styles.chartPlaceholderText, { color: colors.mutedForeground }]}>
              Balance graph appears after first scan
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total P&L</Text>
            <Text style={[styles.statValue, { color: pnlPositive ? colors.success : colors.destructive }]}>
              {pnlPositive ? "+" : ""}${(portfolio?.totalPnl ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Win Rate</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {(portfolio?.winRate ?? 0).toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Trades</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {portfolio?.totalTrades ?? 0}
            </Text>
          </View>
        </View>
        {/* Allocation bar */}
        <View style={styles.allocationRow}>
          <Text style={[styles.allocationLabel, { color: colors.mutedForeground }]}>
            In trades: ${(portfolio?.allocatedInTrades ?? 0).toFixed(0)}
          </Text>
          <Text style={[styles.allocationLabel, { color: colors.mutedForeground }]}>
            Allocated: {settings?.allocation ?? 50}%
          </Text>
        </View>
      </View>

      {/* Bot Toggle */}
      <TouchableOpacity
        onPress={handleBotToggle}
        disabled={bot.isStarting || bot.isStopping}
        style={[
          styles.botButton,
          {
            backgroundColor: bot.isRunning
              ? `${colors.destructive}22`
              : `${colors.primary}22`,
            borderColor: bot.isRunning ? colors.destructive : colors.primary,
          },
        ]}
      >
        <View style={styles.botButtonInner}>
          {bot.isStarting || bot.isStopping ? (
            <ActivityIndicator color={bot.isRunning ? colors.destructive : colors.primary} />
          ) : (
            <Feather
              name={bot.isRunning ? "pause-circle" : "play-circle"}
              size={28}
              color={bot.isRunning ? colors.destructive : colors.primary}
            />
          )}
          <View style={styles.botButtonText}>
            <Text style={[styles.botButtonTitle, { color: bot.isRunning ? colors.destructive : colors.primary }]}>
              {bot.isRunning ? "Stop Bot" : "Start Bot"}
            </Text>
            <Text style={[styles.botButtonSub, { color: colors.mutedForeground }]}>
              {bot.isRunning
                ? `${activeTrades.length} active trade${activeTrades.length !== 1 ? "s" : ""} · scanning every 30s`
                : "Ready to scan 47 coins"}
            </Text>
          </View>
          <View style={[styles.runningDot, { backgroundColor: bot.isRunning ? colors.success : colors.mutedForeground }]} />
        </View>
      </TouchableOpacity>

      {/* Active Trades */}
      {activeTrades.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Trades</Text>
          {activeTrades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </View>
      )}

      {/* Empty state */}
      {bot.isRunning && activeTrades.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Scanning Markets</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            All 7 strategies are voting. Waiting for {settings?.voteThreshold ?? 4}+ buy votes.
          </Text>
        </View>
      )}

      {!bot.isRunning && activeTrades.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="power" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Bot Offline</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Start the bot to begin scanning 47 coins with the voting engine.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greeting: { fontSize: 12, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 2 },
  modePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  portfolioCard: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16 },
  balanceLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 6 },
  balanceAmount: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -1, marginBottom: 4 },
  chartWrapper: { marginHorizontal: -4, marginBottom: 14 },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 4 },
  chartLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  chartPlaceholder: { height: 40, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  chartPlaceholderText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", marginBottom: 14 },
  statItem: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  statValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statDivider: { width: 1, marginHorizontal: 8 },
  allocationRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  allocationLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  botButton: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20 },
  botButtonInner: { flexDirection: "row", alignItems: "center", gap: 14 },
  botButtonText: { flex: 1 },
  botButtonTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  botButtonSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  runningDot: { width: 8, height: 8, borderRadius: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
