import { PrismaClient, ChannelType, OrderStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ── Users ────────────────────────────────────────────────
  const adminPw = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "admin123", 10);
  const whPw = await bcrypt.hash(process.env.WAREHOUSE_PASSWORD ?? "warehouse123", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash: adminPw, role: UserRole.ADMIN },
  });

  const warehouse = await prisma.user.upsert({
    where: { username: "warehouse" },
    update: {},
    create: { username: "warehouse", passwordHash: whPw, role: UserRole.WAREHOUSE },
  });

  console.log(`  Users: ${admin.username}, ${warehouse.username}`);

  // ── Inventory Locations ──────────────────────────────────
  const skuBins: { sku: string; binCode: string; shelf: string; quantity: number }[] = [
    { sku: "WDG-1001", binCode: "A-01-01", shelf: "A", quantity: 120 },
    { sku: "WDG-1002", binCode: "A-01-02", shelf: "A", quantity: 45 },
    { sku: "ELEC-2001", binCode: "B-02-01", shelf: "B", quantity: 30 },
    { sku: "ELEC-2002", binCode: "B-02-02", shelf: "B", quantity: 18 },
    { sku: "CABLE-3001", binCode: "C-03-01", shelf: "C", quantity: 200 },
    { sku: "SER-4001", binCode: "D-04-01", shelf: "D", quantity: 15 },
    { sku: "SER-4002", binCode: "D-04-02", shelf: "D", quantity: 10 },
  ];

  for (const loc of skuBins) {
    await prisma.inventoryLocation.upsert({
      where: { sku_binCode: { sku: loc.sku, binCode: loc.binCode } },
      update: {},
      create: loc,
    });
  }
  console.log(`  Inventory locations: ${skuBins.length}`);

  // ── Settings ─────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: "shipment_root" },
    update: {},
    create: { key: "shipment_root", value: "./Shipments" },
  });
  await prisma.setting.upsert({
    where: { key: "default_carrier" },
    update: {},
    create: { key: "default_carrier", value: "USPS" },
  });

  // ── Demo Orders ──────────────────────────────────────────
  interface DemoOrder {
    channel: ChannelType;
    externalOrderId: string;
    status: OrderStatus;
    buyerName: string;
    shipToName: string;
    shipToAddress1: string;
    shipToCity: string;
    shipToState: string;
    shipToZip: string;
    orderDate: Date;
    items: { sku: string; title: string; quantity: number; unitPrice: number; serialRequired: boolean; binLocation: string }[];
  }

  const demoOrders: DemoOrder[] = [
    {
      channel: ChannelType.AMAZON,
      externalOrderId: "114-1234567-0000001",
      status: OrderStatus.READY,
      buyerName: "Alice Johnson",
      shipToName: "Alice Johnson",
      shipToAddress1: "123 Oak St",
      shipToCity: "Austin",
      shipToState: "TX",
      shipToZip: "78701",
      orderDate: new Date("2026-02-25"),
      items: [
        { sku: "WDG-1001", title: "Widget Standard", quantity: 2, unitPrice: 12.99, serialRequired: false, binLocation: "A-01-01" },
      ],
    },
    {
      channel: ChannelType.AMAZON,
      externalOrderId: "114-1234567-0000002",
      status: OrderStatus.READY,
      buyerName: "Bob Smith",
      shipToName: "Bob Smith",
      shipToAddress1: "456 Elm Ave",
      shipToCity: "Dallas",
      shipToState: "TX",
      shipToZip: "75201",
      orderDate: new Date("2026-02-25"),
      items: [
        { sku: "ELEC-2001", title: "Electronic Gadget A", quantity: 1, unitPrice: 49.99, serialRequired: true, binLocation: "B-02-01" },
        { sku: "CABLE-3001", title: "USB-C Cable 6ft", quantity: 3, unitPrice: 7.99, serialRequired: false, binLocation: "C-03-01" },
      ],
    },
    {
      channel: ChannelType.AMAZON,
      externalOrderId: "114-1234567-0000003",
      status: OrderStatus.NEW,
      buyerName: "Carol Davis",
      shipToName: "Carol Davis",
      shipToAddress1: "789 Pine Ln",
      shipToCity: "Houston",
      shipToState: "TX",
      shipToZip: "77001",
      orderDate: new Date("2026-02-26"),
      items: [
        { sku: "SER-4001", title: "Serial Device Alpha", quantity: 1, unitPrice: 129.99, serialRequired: true, binLocation: "D-04-01" },
      ],
    },
    {
      channel: ChannelType.EBAY,
      externalOrderId: "12-34567-89001",
      status: OrderStatus.READY,
      buyerName: "Dave Wilson",
      shipToName: "Dave Wilson",
      shipToAddress1: "321 Maple Dr",
      shipToCity: "Phoenix",
      shipToState: "AZ",
      shipToZip: "85001",
      orderDate: new Date("2026-02-25"),
      items: [
        { sku: "WDG-1002", title: "Widget Deluxe", quantity: 1, unitPrice: 19.99, serialRequired: false, binLocation: "A-01-02" },
      ],
    },
    {
      channel: ChannelType.EBAY,
      externalOrderId: "12-34567-89002",
      status: OrderStatus.READY,
      buyerName: "Eva Martinez",
      shipToName: "Eva Martinez",
      shipToAddress1: "654 Birch Rd",
      shipToCity: "Tucson",
      shipToState: "AZ",
      shipToZip: "85701",
      orderDate: new Date("2026-02-25"),
      items: [
        { sku: "SER-4002", title: "Serial Device Beta", quantity: 2, unitPrice: 89.99, serialRequired: true, binLocation: "D-04-02" },
      ],
    },
    {
      channel: ChannelType.WALMART,
      externalOrderId: "WMT-900001",
      status: OrderStatus.READY,
      buyerName: "Frank Lee",
      shipToName: "Frank Lee",
      shipToAddress1: "987 Cedar Ct",
      shipToCity: "Denver",
      shipToState: "CO",
      shipToZip: "80201",
      orderDate: new Date("2026-02-24"),
      items: [
        { sku: "WDG-1001", title: "Widget Standard", quantity: 5, unitPrice: 12.99, serialRequired: false, binLocation: "A-01-01" },
        { sku: "CABLE-3001", title: "USB-C Cable 6ft", quantity: 2, unitPrice: 7.99, serialRequired: false, binLocation: "C-03-01" },
      ],
    },
    {
      channel: ChannelType.WALMART,
      externalOrderId: "WMT-900002",
      status: OrderStatus.HOLD,
      buyerName: "Grace Kim",
      shipToName: "Grace Kim",
      shipToAddress1: "111 Spruce Way",
      shipToCity: "Boulder",
      shipToState: "CO",
      shipToZip: "80302",
      orderDate: new Date("2026-02-24"),
      items: [
        { sku: "ELEC-2002", title: "Electronic Gadget B", quantity: 1, unitPrice: 69.99, serialRequired: true, binLocation: "B-02-02" },
      ],
    },
    {
      channel: ChannelType.TEMU,
      externalOrderId: "TEMU-T-550001",
      status: OrderStatus.READY,
      buyerName: "Henry Nguyen",
      shipToName: "Henry Nguyen",
      shipToAddress1: "222 Willow Blvd",
      shipToCity: "Portland",
      shipToState: "OR",
      shipToZip: "97201",
      orderDate: new Date("2026-02-25"),
      items: [
        { sku: "WDG-1001", title: "Widget Standard", quantity: 1, unitPrice: 12.99, serialRequired: false, binLocation: "A-01-01" },
        { sku: "WDG-1002", title: "Widget Deluxe", quantity: 1, unitPrice: 19.99, serialRequired: false, binLocation: "A-01-02" },
      ],
    },
    {
      channel: ChannelType.TEMU,
      externalOrderId: "TEMU-T-550002",
      status: OrderStatus.NEW,
      buyerName: "Irene Patel",
      shipToName: "Irene Patel",
      shipToAddress1: "333 Aspen St",
      shipToCity: "Seattle",
      shipToState: "WA",
      shipToZip: "98101",
      orderDate: new Date("2026-02-26"),
      items: [
        { sku: "SER-4001", title: "Serial Device Alpha", quantity: 1, unitPrice: 129.99, serialRequired: true, binLocation: "D-04-01" },
        { sku: "CABLE-3001", title: "USB-C Cable 6ft", quantity: 1, unitPrice: 7.99, serialRequired: false, binLocation: "C-03-01" },
      ],
    },
    {
      channel: ChannelType.OTHER,
      externalOrderId: "MANUAL-001",
      status: OrderStatus.READY,
      buyerName: "Jake Reeves",
      shipToName: "Jake Reeves",
      shipToAddress1: "444 Redwood Ave",
      shipToCity: "San Francisco",
      shipToState: "CA",
      shipToZip: "94102",
      orderDate: new Date("2026-02-25"),
      items: [
        { sku: "ELEC-2001", title: "Electronic Gadget A", quantity: 1, unitPrice: 49.99, serialRequired: true, binLocation: "B-02-01" },
      ],
    },
  ];

  const createdOrders: string[] = [];

  for (const demo of demoOrders) {
    const { items, ...orderData } = demo;
    const order = await prisma.order.upsert({
      where: {
        channel_externalOrderId: {
          channel: orderData.channel,
          externalOrderId: orderData.externalOrderId,
        },
      },
      update: {},
      create: {
        ...orderData,
        items: {
          create: items.map((it) => ({
            sku: it.sku,
            title: it.title,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            serialRequired: it.serialRequired,
            binLocation: it.binLocation,
          })),
        },
        // Create a pending shipment for each order
        shipment: { create: {} },
      },
    });
    createdOrders.push(order.id);
  }
  console.log(`  Orders: ${createdOrders.length}`);

  // ── Batch with first 4 READY orders ──────────────────────
  const readyOrders = await prisma.order.findMany({
    where: { status: OrderStatus.READY },
    take: 4,
    orderBy: { createdAt: "asc" },
  });

  const batch = await prisma.batch.create({
    data: {
      name: "WAVE-2026-02-26-001",
      strategy: "multi_sku",
      batchOrders: {
        create: readyOrders.map((o, i) => ({
          orderId: o.id,
          position: i,
        })),
      },
    },
  });
  console.log(`  Batch "${batch.name}" with ${readyOrders.length} orders`);

  // ── Audit log for seed run ───────────────────────────────
  await prisma.auditLog.create({
    data: {
      action: "ORDER_IMPORTED",
      detail: `Seed created ${createdOrders.length} demo orders`,
      userId: admin.id,
    },
  });

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
