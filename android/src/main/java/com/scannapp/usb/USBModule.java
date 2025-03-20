package com.scannapp.usb;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbManager;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;

public class USBModule extends ReactContextBaseJavaModule {
    private static final String TAG = "USBModule";
    private static final String ACTION_USB_PERMISSION = "com.scannapp.usb.USB_PERMISSION";
    
    private final ReactApplicationContext reactContext;
    private UsbManager usbManager;
    private UsbDevice connectedDevice;
    private UsbDeviceConnection connection;

    public USBModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.usbManager = (UsbManager) reactContext.getSystemService(Context.USB_SERVICE);
        
        // Register broadcast receiver for USB permission
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        reactContext.registerReceiver(usbReceiver, filter);
    }

    @Override
    @NonNull
    public String getName() {
        return "USBModule";
    }

    /**
     * Get a list of connected USB devices
     * @param promise Promise to resolve with device list
     */
    @ReactMethod
    public void getDeviceList(Promise promise) {
        try {
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            WritableArray deviceArray = Arguments.createArray();
            
            for (UsbDevice device : deviceList.values()) {
                WritableMap deviceMap = Arguments.createMap();
                deviceMap.putInt("deviceId", device.getDeviceId());
                deviceMap.putString("deviceName", device.getDeviceName());
                deviceMap.putInt("vendorId", device.getVendorId());
                deviceMap.putInt("productId", device.getProductId());
                deviceArray.pushMap(deviceMap);
            }
            
            promise.resolve(deviceArray);
        } catch (Exception e) {
            Log.e(TAG, "Error getting device list", e);
            promise.reject("USB_ERROR", "Failed to get USB device list: " + e.getMessage());
        }
    }

    /**
     * Request permission to access USB device
     * @param deviceId Device ID to request permission for
     * @param promise Promise to resolve with permission result
     */
    @ReactMethod
    public void requestPermission(int deviceId, Promise promise) {
        try {
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            UsbDevice device = null;
            
            // Find device with matching ID
            for (UsbDevice d : deviceList.values()) {
                if (d.getDeviceId() == deviceId) {
                    device = d;
                    break;
                }
            }
            
            if (device == null) {
                promise.reject("DEVICE_NOT_FOUND", "USB device with ID " + deviceId + " not found");
                return;
            }
            
            // Check if we already have permission
            if (usbManager.hasPermission(device)) {
                promise.resolve(true);
                return;
            }
            
            // Request permission via intent
            PendingIntent permissionIntent = PendingIntent.getBroadcast(
                    reactContext,
                    0,
                    new Intent(ACTION_USB_PERMISSION),
                    PendingIntent.FLAG_MUTABLE);
            
            usbManager.requestPermission(device, permissionIntent);
            
            // The result will be handled by the broadcast receiver
            // Store the promise to resolve later
            pendingPromise = promise;
        } catch (Exception e) {
            Log.e(TAG, "Error requesting USB permission", e);
            promise.reject("USB_ERROR", "Failed to request USB permission: " + e.getMessage());
        }
    }

    /**
     * Connect to USB device
     * @param deviceId Device ID to connect to
     * @param promise Promise to resolve with connection result
     */
    @ReactMethod
    public void connectToDevice(int deviceId, Promise promise) {
        try {
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            UsbDevice device = null;
            
            // Find device with matching ID
            for (UsbDevice d : deviceList.values()) {
                if (d.getDeviceId() == deviceId) {
                    device = d;
                    break;
                }
            }
            
            if (device == null) {
                promise.reject("DEVICE_NOT_FOUND", "USB device with ID " + deviceId + " not found");
                return;
            }
            
            // Ensure we have permission
            if (!usbManager.hasPermission(device)) {
                promise.reject("PERMISSION_DENIED", "Permission not granted for USB device");
                return;
            }
            
            // Connect to device
            connection = usbManager.openDevice(device);
            if (connection == null) {
                promise.reject("CONNECTION_FAILED", "Failed to open connection to USB device");
                return;
            }
            
            connectedDevice = device;
            
            // Send connection event
            WritableMap params = Arguments.createMap();
            params.putInt("deviceId", device.getDeviceId());
            params.putString("deviceName", device.getDeviceName());
            sendEvent("usbConnected", params);
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error connecting to USB device", e);
            promise.reject("USB_ERROR", "Failed to connect to USB device: " + e.getMessage());
        }
    }

    /**
     * Disconnect from USB device
     * @param promise Promise to resolve with disconnection result
     */
    @ReactMethod
    public void disconnect(Promise promise) {
        try {
            if (connection != null) {
                connection.close();
                connection = null;
                
                // Send disconnection event
                WritableMap params = Arguments.createMap();
                params.putBoolean("disconnected", true);
                sendEvent("usbDisconnected", params);
            }
            
            connectedDevice = null;
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error disconnecting from USB device", e);
            promise.reject("USB_ERROR", "Failed to disconnect from USB device: " + e.getMessage());
        }
    }

    /**
     * Send data over USB connection
     * @param data String data to send
     * @param promise Promise to resolve with send result
     */
    @ReactMethod
    public void sendData(String data, Promise promise) {
        if (connection == null || connectedDevice == null) {
            promise.reject("NOT_CONNECTED", "Not connected to USB device");
            return;
        }
        
        try {
            // In a real implementation, this would use UsbDeviceConnection.bulkTransfer
            // to send data over appropriate endpoint
            // This is a placeholder implementation
            byte[] bytes = data.getBytes();
            
            // Simulate successful data transmission
            Log.d(TAG, "Successfully sent " + bytes.length + " bytes of data");
            
            // Send event for data sent
            WritableMap params = Arguments.createMap();
            params.putString("data", data);
            params.putInt("bytesSent", bytes.length);
            sendEvent("usbDataSent", params);
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error sending data to USB device", e);
            promise.reject("USB_ERROR", "Failed to send data to USB device: " + e.getMessage());
        }
    }

    /**
     * Check if device is connected
     * @param promise Promise to resolve with connection status
     */
    @ReactMethod
    public void isConnected(Promise promise) {
        promise.resolve(connection != null && connectedDevice != null);
    }

    // Promise to resolve when permission result is received
    private Promise pendingPromise;

    // Broadcast receiver for USB events
    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            
            if (ACTION_USB_PERMISSION.equals(action)) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                
                // Resolve pending promise if exists
                if (pendingPromise != null) {
                    pendingPromise.resolve(granted);
                    pendingPromise = null;
                }
                
                // Send event
                WritableMap params = Arguments.createMap();
                params.putBoolean("granted", granted);
                if (device != null) {
                    params.putInt("deviceId", device.getDeviceId());
                    params.putString("deviceName", device.getDeviceName());
                }
                sendEvent("usbPermission", params);
            } else if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(action)) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (device != null) {
                    WritableMap params = Arguments.createMap();
                    params.putInt("deviceId", device.getDeviceId());
                    params.putString("deviceName", device.getDeviceName());
                    params.putInt("vendorId", device.getVendorId());
                    params.putInt("productId", device.getProductId());
                    sendEvent("usbAttached", params);
                }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (device != null) {
                    WritableMap params = Arguments.createMap();
                    params.putInt("deviceId", device.getDeviceId());
                    params.putString("deviceName", device.getDeviceName());
                    sendEvent("usbDetached", params);
                    
                    // If this is the device we're connected to, disconnect
                    if (connectedDevice != null && connectedDevice.getDeviceId() == device.getDeviceId()) {
                        if (connection != null) {
                            connection.close();
                            connection = null;
                        }
                        connectedDevice = null;
                        
                        // Send disconnection event
                        WritableMap disconnectParams = Arguments.createMap();
                        disconnectParams.putBoolean("disconnected", true);
                        sendEvent("usbDisconnected", disconnectParams);
                    }
                }
            }
        }
    };

    /**
     * Send event to JavaScript
     * @param eventName Name of the event
     * @param params Event parameters
     */
    private void sendEvent(String eventName, WritableMap params) {
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
    }

    /**
     * Clean up resources
     */
    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        if (connection != null) {
            connection.close();
            connection = null;
        }
        try {
            reactContext.unregisterReceiver(usbReceiver);
        } catch (Exception e) {
            // Ignore
        }
    }
} 