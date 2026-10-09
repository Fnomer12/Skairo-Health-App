import { BleManager, Device } from "@sfourdrinier/react-native-ble-plx";
import { Platform, PermissionsAndroid } from "react-native";
import { encode, decode } from "base-64";

export const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const COMMAND_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
export const READING_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

export const DEVICE_NAME = "SkairoHealth";

const manager = new BleManager();

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);

  return (
    granted["android.permission.BLUETOOTH_SCAN"] === PermissionsAndroid.RESULTS.GRANTED &&
    granted["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED &&
    granted["android.permission.ACCESS_FINE_LOCATION"] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export function scanForDevice(
  onDeviceFound: (device: Device) => void,
  onError: (error: Error) => void
) {
  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      onError(error);
      return;
    }
    if (device && device.name === DEVICE_NAME) {
      onDeviceFound(device);
    }
  });
}

export function stopScan() {
  manager.stopDeviceScan();
}

export async function connectToDevice(device: Device): Promise<Device> {
  const connected = await device.connect();
  await connected.discoverAllServicesAndCharacteristics();
  return connected;
}

export async function disconnectDevice(device: Device) {
  await device.cancelConnection();
}

export type Reading = {
  heartRate: number;
  temperature: number;
  spo2: number;
  status: string;
};

export function requestReading(
  device: Device,
  onReading: (reading: Reading) => void,
  onError: (error: Error) => void
) {
  const subscription = device.monitorCharacteristicForService(
    SERVICE_UUID,
    READING_CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) {
        onError(error);
        return;
      }
      if (!characteristic?.value) return;

      const raw = decode(characteristic.value);
      const [hr, temp, spo2, status] = raw.split(",");

      onReading({
        heartRate: parseFloat(hr),
        temperature: parseFloat(temp),
        spo2: parseFloat(spo2),
        status: status?.trim() ?? "Unknown",
      });

      subscription.remove();
    }
  );

  device
    .writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      COMMAND_CHARACTERISTIC_UUID,
      encode("READ")
    )
    .catch(onError);
}

export { manager as bleManager };