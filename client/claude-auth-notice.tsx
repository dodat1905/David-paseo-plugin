import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { Text, View } from "react-native";

export function Notice({ item, theme }: PluginTimelineItemProps<{ message: string }>) {
  const styles = useMemo(
    () => ({
      row: { paddingVertical: 4 },
      text: { color: theme.colors.foregroundMuted },
    }),
    [theme],
  );
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{item.data.message}</Text>
    </View>
  );
}
