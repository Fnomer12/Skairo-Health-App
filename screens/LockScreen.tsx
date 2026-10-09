import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

type Props = {
  onUnlock: () => void;
};

export default function LockScreen({ onUnlock }: Props) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    setChecking(true);
    setError(null);

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      setError("No phone passcode or biometrics set up on this device.");
      setChecking(false);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock to view your health records",
      fallbackLabel: "Use passcode",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });

    if (result.success) {
      onUnlock();
    } else {
      setError("Authentication was cancelled or failed. Try again.");
    }
    setChecking(false);
  }, [onUnlock]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Skairo Health</Text>
      <Text style={styles.subtitle}>Your records are locked</Text>

      {checking ? (
        <ActivityIndicator size="large" style={{ marginTop: 24 }} />
      ) : (
        <>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={authenticate}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#000000",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "AvenirNext-Bold" : undefined,
  },
  subtitle: {
    color: "#6b6b6b",
    fontSize: 16,
    marginBottom: 32,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "AvenirNext-Medium" : undefined,
  },
  error: {
    color: "#b00020",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#000000",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});