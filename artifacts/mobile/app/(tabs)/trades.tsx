import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useGetTrades, getGetTradesQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { TradeCard } from "@/components/TradeCard";

type Filter = "all" | "open" | "closed";

export default function TradesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, refetch } = useGetTrades(
    {},
    {
      query: {
        refetchInterval: 10000,
        refetchIntervalInBackground: false,
        queryKey: getGetTradesQueryKey(),
        placeholderData: (prev: any) => prev,
        retry: 1,
      },
    }
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const trades = data?.trades ?? [];
  const filtered = trades.filter((t) => {
    if (filter === "open") return t.status === "open";
    if (filter === "closed") return t.status !== "open";
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Trades</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.openDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.statChipText, { color: colors.foreground }]}>{data?.openCount ?? 0} open</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statChipText, { color: colors.foreground }]}>{data?.closedCount ?? 0} closed</Text>
          </View>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { paddingHorizontal: 16, marginBottom: 8 }]}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[
              styles.filterTab,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.card,
                borderColor: filter === f.key ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.filterText, { color: filter === f.key ? colors.primaryForeground : colors.mutedForeground }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No trades yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Start the bot to begin trading
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TradeCard trade={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 84 : 84 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          scrollEnabled
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 8 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  statChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
