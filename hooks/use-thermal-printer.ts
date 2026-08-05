"use client"

import { useCallback, useEffect, useState } from "react"
import {
  connectThermalPrinter,
  disconnectThermalPrinter,
  isThermalPrinterConnected,
  isWebSerialSupported,
  printThermalReceipt,
  reconnectThermalPrinter,
} from "@/lib/printing/thermal-printer-client"
import type { ReceiptData } from "@/lib/printing/receipt-data"

export function useThermalPrinter() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [supported] = useState(isWebSerialSupported)

  const refresh = useCallback(() => {
    setConnected(isThermalPrinterConnected())
  }, [])

  useEffect(() => {
    void reconnectThermalPrinter().finally(refresh)
  }, [refresh])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      await connectThermalPrinter()
      setConnected(true)
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    await disconnectThermalPrinter()
    setConnected(false)
  }, [])

  const printReceipt = useCallback(async (receipt: ReceiptData) => {
    const mode = await printThermalReceipt(receipt)
    refresh()
    return mode
  }, [refresh])

  return {
    supported,
    connected,
    connecting,
    connect,
    disconnect,
    printReceipt,
  }
}
