import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSettings,
  useUpdateSettings,
  useSaveKeys,
  useDeleteKeys,
  useGetKeysStatus,
  getGetSettingsQueryKey,
  getGetPortfolioQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const SCREEN_H_PAD = 16; // horizontal padding on each side of content
const CARD_PAD = 16;     // horizontal padding inside card
const INPUT_W = 72;      // fixed width of the number input box
const ROW_GAP = 10;      // gap between info and input

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Width available for the label/desc inside a card row
  const infoWidth = screenWidth - SCREEN_H_PAD * 2 - CARD_PAD * 2 - INPUT_W - ROW_GAP;

  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: keysStatus } = useGetKeysStatus({});
  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
      },
    },
  });
  const saveKeys = useSaveKeys({ mutation: { onSuccess: () => queryClient.invalidateQueries() } });
  const deleteKeys = useDeleteKeys({ mutation: { onSuccess: () => queryClient.invalidateQueries() } });

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [allocation, setAllocation] = useState("50");
  const [profitTarget, setProfitTarget] = useState("5");
  const [trailingStop, setTrailingStop] = useState("2");
  const [stopLossPercent, setStopLossPercent] = useState("7");
  const [voteThreshold, setVoteThreshold] = useState("4");

  useEffect(() => {
    if (settings) {
      setAllocation(String(settings.allocation));
      setProfitTarget(String(settings.profitTarget));
      setTrailingStop(String(settings.trailingStop));
      setStopLossPercent(String(settings.stopLossPercent ?? 7));
      setVoteThreshold(String(settings.voteThreshold));
    }
  }, [settings]);

  const handleSaveKeys = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      Alert.alert("Error", "Both API key and secret are required");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveKeys.mutate({ data: { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() } });
    setApiKey("");
    setApiSecret("");
  };

  const handleDeleteKeys = () => {
    Alert.alert("Remove API Keys", "This will also switch to paper trading mode.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteKeys.mutate({}) },
    ]);
  };

  const handleSaveSettings = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings.mutate({
      data: {
        allocation: parseFloat(allocation) || 50,
        mode: settings?.mode ?? "paper",
        profitTarget: parseFloat(profitTarget) || 5,
        trailingStop: parseFloat(trailingStop) || 2,
        stopLossPercent: parseFloat(stopLossPercent) || 7,
        maxConcurrentTrades: settings?.maxConcurrentTrades ?? 2,
        voteThreshold: parseInt(voteThreshold) || 4,
      },
    });
  };

  const handleModeToggle = (toLive: boolean) => {
    if (toLive && !keysStatus?.configured) {
      Alert.alert("API Keys Required", "Add your Binance.US API keys before switching to live mode.");
      return;
    }
    const base = {
      allocation: settings?.allocation ?? 50,
      profitTarget: settings?.profitTarget ?? 5,
      trailingStop: settings?.trailingStop ?? 2,
      stopLossPercent: settings?.stopLossPercent ?? 7,
      maxConcurrentTrades: settings?.maxConcurrentTrades ?? 2,
      voteThreshold: settings?.voteThreshold ?? 4,
    };
    if (toLive) {
      Alert.alert(
        "Enable Live Trading",
        "This will place real orders on Binance.US using your actual funds. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable Live",
            style: "destructive",
            onPress: () => updateSettings.mutate({ data: { ...base, mode: "live" } }),
          },
        ]
      );
    } else {
      updateSettings.mutate({ data: { ...base, mode: "paper" } });
    }
  };

  const isLive = settings?.mode === "live";
  const cardWidth = screenWidth - SCREEN_H_PAD * 2;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 34 + 84 : 84 }]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

      {/* ── API Keys ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BINANCE.US API KEYS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, width: cardWidth }]}>
        {keysStatus?.configured ? (
          <View style={styles.keysConfigured}>
            <View style={[styles.keysBadge, { backgroundColor: `${(colors as any).success}22` }]}>
              <Feather name="check-circle" size={16} color={(colors as any).success} />
              <Text style={[styles.keysBadgeText, { color: (colors as any).success }]}>API Keys Configured</Text>
            </View>
            <TouchableOpacity onPress={handleDeleteKeys} style={[styles.removeBtn, { borderColor: colors.destructive }]}>
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text style={[styles.removeBtnText, { color: colors.destructive }]}>Remove Keys</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
              Keys are stored in memory only and never sent outside your server.
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="key" size={14} color={colors.mutedForeground} />
              <TextInput
                placeholder="API Key"
                placeholderTextColor={colors.mutedForeground}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.textInput, { color: colors.foreground }]}
              />
              <TouchableOpacity onPress={() => setShowKey(!showKey)}>
                <Feather name={showKey ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="lock" size={14} color={colors.mutedForeground} />
              <TextInput
                placeholder="API Secret"
                placeholderTextColor={colors.mutedForeground}
                value={apiSecret}
                onChangeText={setApiSecret}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.textInput, { color: colors.foreground }]}
              />
            </View>
            <TouchableOpacity
              onPress={handleSaveKeys}
              disabled={saveKeys.isPending}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              {saveKeys.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Save Keys</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Trading Mode ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TRADING MODE</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, width: cardWidth }]}>
        <View style={styles.modeRow}>
          <View style={styles.modeInfo}>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>
              {isLive ? "Live Trading" : "Paper Trading"}
            </Text>
            <Text style={[styles.modeSub, { color: colors.mutedForeground }]}>
              {isLive ? "Real orders on Binance.US with real funds" : "Simulated trades with $10,000 virtual balance"}
            </Text>
          </View>
          <Switch
            value={isLive}
            onValueChange={handleModeToggle}
            trackColor={{ false: colors.secondary, true: `${colors.destructive}88` }}
            thumbColor={isLive ? colors.destructive : colors.mutedForeground}
          />
        </View>
        {isLive && (
          <View style={[styles.warningBanner, { backgroundColor: `${colors.destructive}22` }]}>
            <Feather name="alert-triangle" size={14} color={colors.destructive} />
            <Text style={[styles.warningText, { color: colors.destructive }]}>
              Live mode uses real funds. Bot will place actual Binance.US orders.
            </Text>
          </View>
        )}
      </View>

      {/* ── Bot Parameters ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BOT PARAMETERS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, width: cardWidth }]}>
        {[
          { label: "Balance Allocation", desc: "% of USD balance to use for trading", value: allocation, setter: setAllocation, unit: "%" },
          { label: "Profit Target", desc: "Minimum profit before trailing stop activates", value: profitTarget, setter: setProfitTarget, unit: "%" },
          { label: "Trailing Stop Loss", desc: "Close trade if price drops this % from peak", value: trailingStop, setter: setTrailingStop, unit: "%" },
          { label: "Hard Stop Loss", desc: "Force-close trade if it drops this % below entry", value: stopLossPercent, setter: setStopLossPercent, unit: "%" },
          { label: "Vote Threshold", desc: "Min strategy buy votes to open a trade (max 7)", value: voteThreshold, setter: setVoteThreshold, unit: "/7" },
        ].map((row, i) => (
          <React.Fragment key={row.label}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            <View style={styles.paramRow}>
              <View style={{ width: infoWidth }}>
                <Text style={[styles.paramLabel, { color: colors.foreground }]} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={[styles.paramDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {row.desc}
                </Text>
              </View>
              <View style={[styles.numBox, { backgroundColor: colors.secondary, borderColor: colors.border, width: INPUT_W }]}>
                <TextInput
                  value={row.value}
                  onChangeText={row.setter}
                  keyboardType="numeric"
                  style={[styles.numInput, { color: colors.foreground, width: INPUT_W - 28 }]}
                />
                <Text style={[styles.numUnit, { color: colors.mutedForeground }]}>{row.unit}</Text>
              </View>
            </View>
          </React.Fragment>
        ))}

        <TouchableOpacity
          onPress={handleSaveSettings}
          disabled={updateSettings.isPending}
          style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
        >
          {updateSettings.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <Feather name="check" size={16} color={colors.primaryForeground} />
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── How It Works ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>HOW IT WORKS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, width: cardWidth }]}>
        {[
          { icon: "activity" as const, title: "7 Simultaneous Strategies", desc: "RSI, MACD, Bollinger, EMA, VWAP, Momentum, and ML Pattern all run at once" },
          { icon: "check-square" as const, title: "Weighted Voting", desc: `A trade opens when ${settings?.voteThreshold ?? 4}+ strategies vote BUY` },
          { icon: "trending-up" as const, title: "Smart Profit Taking", desc: `Takes profit at ${settings?.profitTarget ?? 5}% minimum, then trails with a ${settings?.trailingStop ?? 2}% stop` },
          { icon: "cpu" as const, title: "Continuous Learning", desc: "Strategy weights auto-adjust based on historical win rates per coin" },
        ].map((item, i) => (
          <View key={i} style={[styles.howRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[styles.howIcon, { backgroundColor: colors.accent }]}>
              <Feather name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.howTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.howDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SCREEN_H_PAD },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, padding: CARD_PAD, marginBottom: 20 },
  cardNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 14, lineHeight: 18 },
  keysConfigured: { gap: 12 },
  keysBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  keysBadgeText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start" },
  removeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginBottom: 10 },
  textInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 14, gap: 8 },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modeSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },
  warningBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 10, marginTop: 14 },
  warningText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },
  paramRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, gap: ROW_GAP },
  paramLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  paramDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 16 },
  numBox: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 8, overflow: "hidden" },
  numInput: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  numUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { height: 1 },
  howRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14 },
  howIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  howTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  howDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },
});
