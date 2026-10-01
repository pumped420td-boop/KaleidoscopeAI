import React, { createContext, useContext, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBotStatus,
  useStartBot,
  useStopBot,
  useGetPortfolio,
  useGetSettings,
  useGetKeysStatus,
  getGetBotStatusQueryKey,
  getGetPortfolioQueryKey,
  getGetTradesQueryKey,
  getGetStrategiesQueryKey,
  getGetVotesQueryKey,
  getGetTickerQueryKey,
} from "@workspace/api-client-react";

interface BotContextValue {
  isRunning: boolean;
  isPaper: boolean;
  startBot: () => void;
  stopBot: () => void;
  isStarting: boolean;
  isStopping: boolean;
}

const BotContext = createContext<BotContextValue>({
  isRunning: false,
  isPaper: true,
  startBot: () => {},
  stopBot: () => {},
  isStarting: false,
  isStopping: false,
});

export function BotProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: botStatus } = useGetBotStatus({ query: { refetchInterval: 10000, refetchIntervalInBackground: false, queryKey: getGetBotStatusQueryKey() } });
  const { data: settings } = useGetSettings({});
  const startMutation = useStartBot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
      },
    },
  });
  const stopMutation = useStopBot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTradesQueryKey() });
      },
    },
  });

  const handleStart = useCallback(() => {
    startMutation.mutate();
  }, [startMutation]);

  const handleStop = useCallback(() => {
    stopMutation.mutate();
  }, [stopMutation]);

  return (
    <BotContext.Provider
      value={{
        isRunning: botStatus?.running ?? false,
        isPaper: settings?.mode === "paper",
        startBot: handleStart,
        stopBot: handleStop,
        isStarting: startMutation.isPending,
        isStopping: stopMutation.isPending,
      }}
    >
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  return useContext(BotContext);
}
