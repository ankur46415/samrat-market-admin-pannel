"use client"

import { useCallback, useMemo } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { col } from "@/lib/account-mode"
import { useProducts } from "@/hooks/use-firestore"
import { useSupplierRegistrySnapshot } from "@/hooks/use-supplier-registry-snapshot"
import {
  contactForSupplierName,
  LEGACY_SUPPLIER_NAMES_COL,
  PRODUCT_SUPPLIER_REGISTRY_COL,
  type SupplierRegistryRow,
} from "@/lib/inventory/supplier-registry"

export type SupplierRegistryItem = SupplierRegistryRow & { productCount: number }

export function useProductSupplierRegistry() {
  const { products, loading: productsLoading } = useProducts()
  const { entries: mergedRows, names, loading: storedLoading, contactForName, stored } =
    useSupplierRegistrySnapshot()

  const items = useMemo((): SupplierRegistryItem[] => {
    const counts = new Map<string, number>()
    for (const product of products) {
      const name = String(product.supplierName ?? "").trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return mergedRows.map((row) => ({
      ...row,
      productCount: counts.get(row.name) ?? 0,
    }))
  }, [mergedRows, products])

  const hasName = useCallback(
    (name: string, except?: string) => {
      const n = name.trim().toLowerCase()
      const skip = (except ?? "").trim().toLowerCase()
      return items.some((c) => c.name.toLowerCase() === n && c.name.toLowerCase() !== skip)
    },
    [items]
  )

  const bulkSetSupplierOnProducts = useCallback(
    async (productIds: string[], supplierName: string, supplierContact: string) => {
      if (productIds.length === 0) return
      const chunks: string[][] = []
      for (let i = 0; i < productIds.length; i += 450) {
        chunks.push(productIds.slice(i, i + 450))
      }
      const name = supplierName.trim()
      const contact = supplierContact.trim()
      for (const chunk of chunks) {
        const batch = writeBatch(db)
        const now = Timestamp.now()
        for (const id of chunk) {
          batch.update(doc(db, col("products"), id), {
            supplierName: name,
            supplierContact: contact,
            updatedAt: now,
          })
        }
        await batch.commit()
      }
    },
    []
  )

  const addSupplier = useCallback(
    async (name: string, contact: string) => {
      const nextName = name.trim()
      const nextContact = contact.trim()
      if (!nextName) throw new Error("Supplier name is required")
      if (!nextContact) throw new Error("Supplier contact is required")
      if (hasName(nextName)) throw new Error("That supplier name already exists")
      await addDoc(collection(db, col(PRODUCT_SUPPLIER_REGISTRY_COL)), {
        name: nextName,
        contact: nextContact,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    },
    [hasName]
  )

  const updateSupplier = useCallback(
    async (oldName: string, name: string, contact: string) => {
      const from = oldName.trim()
      const to = name.trim()
      const nextContact = contact.trim()
      if (!from) throw new Error("Not found")
      if (!to) throw new Error("Supplier name is required")
      if (!nextContact) throw new Error("Supplier contact is required")
      if (from.toLowerCase() !== to.toLowerCase() && hasName(to, from)) {
        throw new Error("That supplier name already exists")
      }

      const productIds = products
        .filter((p) => String(p.supplierName ?? "").trim() === from)
        .map((p) => p.id)
      if (productIds.length > 0) {
        await bulkSetSupplierOnProducts(productIds, to, nextContact)
      }

      const row = stored.find((r) => r.name.toLowerCase() === from.toLowerCase())
      const now = Timestamp.now()
      if (row && !row.id.startsWith("legacy:")) {
        await updateDoc(doc(db, col(PRODUCT_SUPPLIER_REGISTRY_COL), row.id), {
          name: to,
          contact: nextContact,
          updatedAt: now,
        })
      } else {
        if (hasName(to, from)) throw new Error("That supplier name already exists")
        await addDoc(collection(db, col(PRODUCT_SUPPLIER_REGISTRY_COL)), {
          name: to,
          contact: nextContact,
          createdAt: now,
          updatedAt: now,
        })
      }
    },
    [bulkSetSupplierOnProducts, hasName, products, stored]
  )

  const deleteSupplier = useCallback(
    async (supplierName: string, moveProductsTo?: string) => {
      const name = supplierName.trim()
      if (!name) throw new Error("Not found")

      const productIds = products
        .filter((p) => String(p.supplierName ?? "").trim().toLowerCase() === name.toLowerCase())
        .map((p) => p.id)

      if (productIds.length > 0) {
        const targetName = (moveProductsTo ?? "").trim()
        if (!targetName) {
          throw new Error("Select where to move products before deleting")
        }
        if (targetName.toLowerCase() === name.toLowerCase()) {
          throw new Error("Choose a different replacement")
        }
        const targetContact = contactForSupplierName(targetName, mergedRows)
        await bulkSetSupplierOnProducts(productIds, targetName, targetContact)
      }

      const row = stored.find((r) => r.name.toLowerCase() === name.toLowerCase())
      if (row && !row.id.startsWith("legacy:")) {
        await deleteDoc(doc(db, col(PRODUCT_SUPPLIER_REGISTRY_COL), row.id))
      }

      const legacySnap = await getDocs(collection(db, col(LEGACY_SUPPLIER_NAMES_COL)))
      await Promise.all(
        legacySnap.docs
          .filter(
            (d) =>
              String((d.data() as { name?: unknown }).name ?? "")
                .trim()
                .toLowerCase() === name.toLowerCase()
          )
          .map((d) => deleteDoc(d.ref))
      )

      return productIds.length
    },
    [bulkSetSupplierOnProducts, mergedRows, products, stored]
  )

  return {
    items,
    names,
    entries: mergedRows,
    loading: productsLoading || storedLoading,
    contactForName,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  }
}
