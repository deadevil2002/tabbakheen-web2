import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "404" }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>🍳</Text>
        <Text style={styles.title}>الصفحة غير موجودة</Text>
        <Text style={styles.subtitle}>Page not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>العودة للرئيسية</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  linkText: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: "600" as const,
  },
});
