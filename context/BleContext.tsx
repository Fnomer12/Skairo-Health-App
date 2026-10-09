import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Device } from "@sfourdrinier/react-native-ble-plx";
import {
  requestBlePermissions,
  scanForDevice,
  stopScan,
  connectToDevice,
  disconnectDevice,
  requestReading,
  Reading,
} from "../ble/bleManager";

type BleContextType = {
  connectedDevice: Device | null;
  isScanning: boolean;
  isConnecting: boolean;
  discoveredDevices: Device[];
  startScan: () => Promise<void>;
  stopScanning: () => void;
  connect: (device: Device) => Promise<void>;
  disconnect: () => Promise<void>;
  takeReading: () => Promise<Reading>;
};

const BleContext = createContext<BleContextType | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const startScan = useCallback(async () => {
    const ok = await requestBlePermissions();
    if (!ok) throw new Error("Bluetooth permission was not granted.");

    seenIds.current.clear();
    setDiscoveredDevices([]);
    setIsScanning(true);

    scanForDevice(
      (device) => {
        if (!seenIds.current.has(device.id)) {
          seenIds.current.add(device.id);
          setDiscoveredDevices((prev) => [...prev, device]);
        }
      },
      (error) => {
        console.warn("BLE scan error:", error.message);
        setIsScanning(false);
      }
    );
  }, []);

  const stopScanning = useCallback(() => {
    stopScan();
    setIsScanning(false);
  }, []);

  const connect = useCallback(async (device: Device) => {
    setIsConnecting(true);
    try {
      stopScan();
      setIsScanning(false);
      const connected = await connectToDevice(device);
      setConnectedDevice(connected);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectedDevice) {
      await disconnectDevice(connectedDevice);
      setConnectedDevice(null);
    }
  }, [connectedDevice]);

  const takeReading = useCallback((): Promise<Reading> => {
    return new Promise((resolve, reject) => {
      if (!connectedDevice) {
        reject(new Error("No device connected."));
        return;
      }
      requestReading(connectedDevice, resolve, reject);
    });
  }, [connectedDevice]);

  return (
    <BleContext.Provider
      value={{
        connectedDevice,
        isScanning,
        isConnecting,
        discoveredDevices,
        startScan,
        stopScanning,
        connect,
        disconnect,
        takeReading,
      }}
    >
      {children}
    </BleContext.Provider>
  );
}

export function useBle() {
  const ctx = useContext(BleContext);
  if (!ctx) throw new Error("useBle must be used within a BleProvider");
  return ctx;
}