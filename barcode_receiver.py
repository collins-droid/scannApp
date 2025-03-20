import tkinter as tk
from tkinter import ttk, scrolledtext
import serial
import json
import threading
import http.server
import socketserver
import time
from datetime import datetime
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('barcode_receiver.log'),
        logging.StreamHandler()
    ]
)

class BarcodeReceiver:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Barcode Receiver")
        self.root.geometry("800x600")
        
        # USB settings
        self.com_port = 'COM7'  # Default COM port
        self.baud_rate = 115200
        self.serial_port = None
        self.is_connected = False
        
        # Network settings
        self.http_port = 5000
        self.http_server = None
        self.http_thread = None
        
        # Create UI
        self.create_ui()
        
        # Start HTTP server
        self.start_http_server()
        
        # Try to connect to USB
        self.connect_usb()
        
    def create_ui(self):
        # Create main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Connection status frame
        status_frame = ttk.LabelFrame(main_frame, text="Connection Status", padding="5")
        status_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        self.usb_status = ttk.Label(status_frame, text="USB: Disconnected")
        self.usb_status.grid(row=0, column=0, padx=5)
        
        self.network_status = ttk.Label(status_frame, text="Network: Disconnected")
        self.network_status.grid(row=0, column=1, padx=5)
        
        # Settings frame
        settings_frame = ttk.LabelFrame(main_frame, text="Settings", padding="5")
        settings_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        ttk.Label(settings_frame, text="COM Port:").grid(row=0, column=0, padx=5)
        self.com_port_entry = ttk.Entry(settings_frame, width=10)
        self.com_port_entry.insert(0, self.com_port)
        self.com_port_entry.grid(row=0, column=1, padx=5)
        
        ttk.Label(settings_frame, text="HTTP Port:").grid(row=0, column=2, padx=5)
        self.http_port_entry = ttk.Entry(settings_frame, width=10)
        self.http_port_entry.insert(0, str(self.http_port))
        self.http_port_entry.grid(row=0, column=3, padx=5)
        
        # Connect/Disconnect buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=2, column=0, columnspan=2, pady=5)
        
        self.connect_button = ttk.Button(button_frame, text="Connect USB", command=self.connect_usb)
        self.connect_button.grid(row=0, column=0, padx=5)
        
        self.disconnect_button = ttk.Button(button_frame, text="Disconnect USB", command=self.disconnect_usb, state=tk.DISABLED)
        self.disconnect_button.grid(row=0, column=1, padx=5)
        
        # Barcode log
        log_frame = ttk.LabelFrame(main_frame, text="Barcode Log", padding="5")
        log_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=20, width=80)
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(3, weight=1)
        
    def log_message(self, message):
        """Add a message to the log with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        logging.info(message)
        
    def connect_usb(self):
        """Connect to USB device"""
        try:
            self.com_port = self.com_port_entry.get()
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()
                time.sleep(1)  # Wait for port to be fully closed
            
            self.serial_port = serial.Serial(
                port=self.com_port,
                baudrate=self.baud_rate,
                timeout=1,
                write_timeout=5,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            
            # Flush any existing data
            self.serial_port.reset_input_buffer()
            self.serial_port.reset_output_buffer()
            
            self.is_connected = True
            self.usb_status.config(text=f"USB: Connected ({self.com_port})")
            self.connect_button.config(state=tk.DISABLED)
            self.disconnect_button.config(state=tk.NORMAL)
            self.log_message(f"Connected to USB device on {self.com_port}")
            
            # Start reading thread
            threading.Thread(target=self.read_usb, daemon=True).start()
        except Exception as e:
            self.log_message(f"Failed to connect to USB: {str(e)}")
            self.is_connected = False
            self.usb_status.config(text="USB: Connection Failed")
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()
                self.serial_port = None
            
    def disconnect_usb(self):
        """Disconnect from USB device"""
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
            self.is_connected = False
            self.usb_status.config(text="USB: Disconnected")
            self.connect_button.config(state=tk.NORMAL)
            self.disconnect_button.config(state=tk.DISABLED)
            self.log_message("Disconnected from USB device")
            
    def read_usb(self):
        """Read data from USB device"""
        buffer = ""
        while self.is_connected:
            try:
                if self.serial_port.in_waiting:
                    # Read all available bytes
                    new_data = self.serial_port.read(self.serial_port.in_waiting).decode('utf-8', errors='replace')
                    self.log_message(f"Raw bytes received: {new_data}")
                    buffer += new_data
                    
                    # Try to extract JSON objects from the buffer
                    while True:
                        # Look for start of JSON object
                        start_idx = buffer.find('{')
                        if start_idx == -1:
                            break
                            
                        # Look for a matching end brace
                        brace_count = 0
                        end_idx = -1
                        
                        for i in range(start_idx, len(buffer)):
                            if buffer[i] == '{':
                                brace_count += 1
                            elif buffer[i] == '}':
                                brace_count -= 1
                                if brace_count == 0:
                                    end_idx = i + 1
                                    break
                        
                        if end_idx == -1:
                            # No complete JSON object found yet
                            self.log_message(f"Buffer contains incomplete JSON: {buffer}")
                            break
                            
                        # Extract the JSON object
                        json_data = buffer[start_idx:end_idx]
                        self.log_message(f"Extracted JSON: {json_data}")
                        
                        # Process the data
                        try:
                            self.process_data(json_data)
                        except Exception as e:
                            self.log_message(f"Error processing USB data: {str(e)}")
                            
                        # Remove processed data from buffer
                        buffer = buffer[end_idx:]
                        self.log_message(f"Remaining buffer: {buffer}")
                
                # Small sleep to prevent CPU hammering
                time.sleep(0.01)
                
            except Exception as e:
                self.log_message(f"Error reading from USB: {str(e)}")
                self.disconnect_usb()
                break
                
    def start_http_server(self):
        """Start HTTP server for network connections"""
        class BarcodeHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                self.receiver = kwargs.pop('receiver')
                super().__init__(*args, **kwargs)
                
            def do_POST(self):
                if self.path == '/barcode':
                    try:
                        content_length = int(self.headers['Content-Length'])
                        post_data = self.rfile.read(content_length)
                        data = json.loads(post_data.decode('utf-8'))
                        self.receiver.process_data(json.dumps(data))
                        
                        # Send acknowledgment
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            "type": "ack",
                            "barcode_id": data.get('data', 'unknown'),
                            "message": "Received",
                            "timestamp": time.time()
                        }).encode())
                    except Exception as e:
                        self.receiver.log_message(f"Error processing HTTP request: {str(e)}")
                        self.send_error(500, str(e))
                else:
                    self.send_error(404, "Not Found")
                    
            def do_GET(self):
                if self.path == '/health':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok"}).encode())
                else:
                    self.send_error(404, "Not Found")
        
        try:
            self.http_port = int(self.http_port_entry.get())
            self.http_server = socketserver.TCPServer(
                ("", self.http_port),
                lambda *args, **kwargs: BarcodeHandler(*args, receiver=self, **kwargs)
            )
            self.http_thread = threading.Thread(target=self.http_server.serve_forever, daemon=True)
            self.http_thread.start()
            self.network_status.config(text=f"Network: Listening on port {self.http_port}")
            self.log_message(f"HTTP server started on port {self.http_port}")
        except Exception as e:
            self.log_message(f"Failed to start HTTP server: {str(e)}")
            self.network_status.config(text="Network: Failed to start")
            
    def process_data(self, data):
        """Process received data from either USB or HTTP"""
        try:
            if isinstance(data, str):
                data = json.loads(data)
                
            # Handle the protocol format from Android app
            if isinstance(data, dict):
                if data.get('type') == 'DATA':
                    # Extract the actual barcode data from the payload
                    barcode_data = data.get('payload', {}).get('content')
                    if barcode_data:
                        # Format the data as expected by the rest of the application
                        formatted_data = {
                            'type': 'barcode',
                            'data': barcode_data,
                            'format': 'UNKNOWN',  # Default format since it's not provided in the protocol
                            'timestamp': time.time()
                        }
                        self.process_barcode_data(formatted_data)
                elif data.get('type') == 'barcode':
                    # Handle direct barcode format
                    self.process_barcode_data(data)
                
        except json.JSONDecodeError:
            self.log_message(f"Invalid JSON received: {data}")
        except Exception as e:
            self.log_message(f"Error processing data: {str(e)}")
            
    def process_barcode_data(self, data):
        """Process formatted barcode data"""
        try:
            barcode_data = data.get('data', 'unknown')
            barcode_format = data.get('format', 'unknown')
            timestamp = data.get('timestamp', time.time())
            
            # Format timestamp
            dt = datetime.fromtimestamp(timestamp)
            formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
            
            # Log the barcode
            self.log_message(f"Barcode: {barcode_data} (Format: {barcode_format})")
            
            # Save to file
            self.save_barcode(barcode_data, barcode_format, formatted_time)
            
        except Exception as e:
            self.log_message(f"Error processing barcode data: {str(e)}")
            
    def save_barcode(self, barcode_data, format, timestamp):
        """Save barcode data to file"""
        try:
            filename = f"barcodes_{datetime.now().strftime('%Y%m%d')}.txt"
            with open(filename, 'a') as f:
                f.write(f"{timestamp} | {barcode_data} | {format}\n")
        except Exception as e:
            self.log_message(f"Error saving barcode to file: {str(e)}")
            
    def run(self):
        """Start the application"""
        self.root.mainloop()
        
    def __del__(self):
        """Cleanup when the application is closed"""
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        if self.http_server:
            self.http_server.shutdown()
            self.http_server.server_close()

if __name__ == "__main__":
    app = BarcodeReceiver()
    app.run() 