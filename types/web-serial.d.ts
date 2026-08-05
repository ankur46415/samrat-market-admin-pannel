interface SerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
}

interface Serial extends EventTarget {
  requestPort(options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
  }): Promise<SerialPort>
  getPorts(): Promise<Array<SerialPort>>
}

interface Navigator {
  serial?: Serial
}
