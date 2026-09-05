import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCloseTrade,
  getGetTradesQueryKey,
  getGetPortfolioQueryKey,
  getGetBotStatusQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import type { Trade } from "@workspace/api-client-react";

interface Props {
  trade: Trade;
}

export function TradeCard({ trade }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [confirmClose, setConfirmClose] = useState(false);
  const quoteAsset = trade.quoteAsset ?? "USD";
  const isProfit = trade.profitPercent >= 0;
  const isOpen = trade.status === "open";

  const profitColor = isProfit ? (colors as any).success : colors.destructive;

  const { mutateAsync: doClose, isPending: isClosing } = useCloseTrade({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTradesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        setConfirmClose(false);
      },
    },
  });

  const handleCloseTap = () => {
    if (!confirmClose) {
      setConfirmClose(true);
      setTimeout(() => setConfirmClose(false), 3000);
    } else {
      doClose({ id: trade.id }).catch(() => {});
    }
  };

  const statusLabel = () => {
    if (isOpen) return trade.trailingActive ? "TRAILING" : "OPEN";
    if (trade.closeReason === "swapped") return "SWAPPED";
    if (trade.status === "stopped") return "STOPPED";
    if (trade.closeReason === "manual") return "CLOSED";
    return trade.status.toUpperCase();
  };

  const statusColor = () => {
    if (isOpen) return colors.primary;
    if (trade.closeReason === "swapped") return (colors as any).warning;
    if (trade.status === "stopped") return colors.destructive;
    return colors.mutedForeground;
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.top}>
        <View style={styles.leftTop}>
          <Text style={[styles.symbol, { color: colors.foreground }]}>{trade.symbol}</Text>
          <Text style={[styles.name, { color: colors.mutedForeground }]}>{trade.name}</Text>
           <Text style={[styles.pair, { color: colors.primary }]}>{trade.pair} · {quoteAsset}</Text>
        </View>
        <View style={styles.rightTop}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor()}22` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor() }]} />
            <Text style={[styles.statusText, { color: statusColor() }]}>{statusLabel()}</Text>
          </View>
          <View style={[styles.modeBadge, { backgroundColor: trade.paperMode ? `${(colors as any).warning}22` : `${(colors as any).success}22` }]}>
            <Text style={[styles.modeText, { color: trade.paperMode ? (colors as any).warning : (colors as any).success }]}>
              {trade.paperMode ? "PAPER" : "LIVE"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.prices}>
        <View style={styles.priceItem}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Entry</Text>
          <Text style={[styles.priceValue, { color: colors.foreground }]}>${formatPrice(trade.entryPrice)}</Text>
        </View>
        <View style={styles.priceItem}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>Current</Text>
          <Text style={[styles.priceValue, { color: colors.foreground }]}>${formatPrice(trade.currentPrice)}</Text>
        </View>
        <View style={styles.priceItem}>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>P&L</Text>
          <Text style={[styles.profitValue, { color: profitColor }]}>
            {isProfit ? "+" : ""}{trade.profitPercent.toFixed(2)}%
          </Text>
          <Text style={[styles.profitUsd, { color: profitColor }]}>
             {isProfit ? "+" : ""}{quoteAsset} {Math.abs(trade.profitUsd).toFixed(2)}
          </Text>
        </View>
      </View>

      {trade.trailingActive && isOpen && (
        <View style={[styles.trailingBanner, { backgroundColor: `${(colors as any).warning}22` }]}>
          <Text style={[styles.trailingText, { color: (colors as any).warning }]}>
            Trailing stop active — peak ${formatPrice(trade.highestPrice)}
          </Text>
        </View>
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          {trade.winningStrategies.slice(0, 3).join(" · ")}
          {trade.winningStrategies.length > 3 ? ` +${trade.winningStrategies.length - 3}` : ""}
        </Text>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
           {quoteAsset} {trade.investedUsd.toFixed(2)} invested
        </Text>
      </View>

      {isOpen && (
        <TouchableOpacity
          onPress={handleCloseTap}
          disabled={isClosing}
          style={[
            styles.closeBtn,
            {
              backgroundColor: confirmClose ? `${colors.destructive}22` : `${colors.destructive}11`,
              borderTopColor: colors.border,
            },
          ]}
        >
          {isClosing ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <>
              <Feather name={confirmClose ? "alert-triangle" : "x-circle"} size={13} color={colors.destructive} />
              <Text style={[styles.closeBtnText, { color: colors.destructive }]}>
                {confirmClose ? "Tap again to confirm close" : "Close Trade"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.001) return price.toFixed(6);
  return price.toFixed(8);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    paddingBottom: 10,
  },
  leftTop: {},
  rightTop: { flexDirection: "row", gap: 6, alignItems: "center" },
  symbol: { fontSize: 18, fontFamily: "Inter_700Bold" },
  name: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pair: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 3 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  modeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  modeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  prices: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 0,
  },
  priceItem: { flex: 1 },
  priceLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 3 },
  priceValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  profitValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  profitUsd: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 1 },
  trailingBanner: {
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  trailingText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  closeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
