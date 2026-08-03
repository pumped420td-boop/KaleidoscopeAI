import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useGetTicker, getGetTickerQueryKey } from "@workspace/api-client-react";
import type { MarketTicker } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type CategoryFilter = "all" | "crypto" | "meme";

export default function MarketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, refetch } = useGetTicker({
    query: {
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
      queryKey: getGetTickerQueryKey(),
      placeholderData: (prev: any) => prev,
      retry: 1,
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const tickers = data?.tickers ?? [];
  const filtered = tickers.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
    }
    return true;
  });

  const renderTicker = ({ item: t }: { item: MarketTicker }) => {
    const isPos = t.change24h >= 0;
    const changeColor = isPos ? (colors as any).success : colors.destructive;

    return (
      <View style={[styles.tickerRow, { borderBottomColor: colors.border }]}>
        <View style={styles.tickerLeft}>
          <View style={[styles.symbolBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.symbolBadgeText, { color: colors.primary }]}>{t.symbol.slice(0, 3)}</Text>
          </View>
          <View>
            <Text style={[styles.tickerSymbol, { color: colors.foreground }]}>{t.symbol}</Text>
            <View style={styles.nameRow}>
              <Text style={[styles.tickerName, { color: colors.mutedForeground }]}>{t.name}</Text>
              {t.category === "meme" && (
                <View style={[styles.memeBadge, { backgroundColor: `${colors.warning}22` }]}>
                  <Text style={[styles.memeBadgeText, { color: colors.warning }]}>MEME</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.tickerRight}>
          <Text style={[styles.tickerPrice, { color: colors.foreground }]}>{formatPrice(t.price)}</Text>
          <View style={[styles.changeBadge, { backgroundColor: `${changeColor}22` }]}>
            <Feather name={isPos ? "arrow-up-right" : "arrow-down-right"} size={10} color={changeColor} />
            <Text style={[styles.changeText, { color: changeColor }]}>{Math.abs(t.change24h).toFixed(2)}%</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerArea, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Market</Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search coins..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category filter */}
        <View style={styles.catRow}>
          {(["all", "crypto", "meme"] as CategoryFilter[]).map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              style={[
                styles.catTab,
                { backgroundColor: category === c ? colors.primary : colors.card, borderColor: category === c ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.catText, { color: category === c ? colors.primaryForeground : colors.mutedForeground }]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{filtered.length} coins</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading market data...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.symbol}
          renderItem={renderTicker}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 + 84 : 84 }}
          scrollEnabled
        />
      )}
    </View>
  );
}

function formatPrice(price: number): string {
  if (price >= 10000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 100) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  catRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  catTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  catText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  countText: { marginLeft: "auto", fontSize: 12, fontFamily: "Inter_400Regular" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  tickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  tickerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  symbolBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  symbolBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  tickerSymbol: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tickerName: { fontSize: 11, fontFamily: "Inter_400Regular" },
  memeBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  memeBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold" },
  tickerRight: { alignItems: "flex-end", gap: 4 },
  tickerPrice: { fontSize: 15, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  changeBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, gap: 3 },
  changeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
