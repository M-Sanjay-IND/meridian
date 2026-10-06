import { PrismaClient, Role, AvailabilityKind, ResourceKind } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Deterministic seed script according to DEV-MANUAL.md §4.2:
 * "200 students, 15 faculty, 5 labs, 1 holiday"
 * Host id = 7 (Prof. Rao) with Service id = 3 on 2026-10-15
 * 5 Labs with capacities 20, 24, 24, 30, 12
 */
async function main() {
  console.log("Starting deterministic seed for Meridian...");

  // 1. Term: Fall 2026
  const term = await prisma.term.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Fall 2026",
      startsOn: new Date("2026-08-01"),
      endsOn: new Date("2026-12-31"),
      timeZone: "Asia/Kolkata",
    },
  });
  console.log(`Term seeded: ${term.name}`);

  // 2. 15 Faculty supervisors (Host id=7 MUST be Prof. Rao)
  const facultyNames = [
    "Dr. Alice Smith",
    "Prof. Bob Johnson",
    "Dr. Carol Williams",
    "Prof. David Brown",
    "Dr. Emma Jones",
    "Prof. Frank Garcia",
    "Prof. Rao", // ID = 7
    "Dr. Grace Martinez",
    "Prof. Henry Davis",
    "Dr. Irene Rodriguez",
    "Prof. Jack Wilson",
    "Dr. Karen Anderson",
    "Prof. Leo Thomas",
    "Dr. Maria Jackson",
    "Prof. Nathan White",
  ];

  for (let i = 0; i < facultyNames.length; i++) {
    const id = i + 1;
    const name = facultyNames[i];
    const email = id === 7 ? "rao@meridian.edu" : `faculty_${id}@meridian.edu`;

    await prisma.user.upsert({
      where: { id },
      update: { name, email, role: Role.FACULTY },
      create: {
        id,
        name,
        email,
        role: Role.FACULTY,
        timeZone: "Asia/Kolkata",
      },
    });
  }
  console.log(`15 Faculty seeded (Host 7: Prof. Rao).`);

  // 3. 5 Labs (Resources) with fixed capacities: 20, 24, 24, 30, 12
  const labConfigs = [
    { id: 1, name: "Computing Lab A", capacity: 20 },
    { id: 2, name: "Robotics Lab B", capacity: 24 },
    { id: 3, name: "Systems Lab C", capacity: 24 },
    { id: 4, name: "Data Science Lab D", capacity: 30 },
    { id: 5, name: "Electronics Lab E", capacity: 12 },
  ];

  for (const lab of labConfigs) {
    await prisma.resource.upsert({
      where: { id: lab.id },
      update: { name: lab.name, capacity: lab.capacity },
      create: {
        id: lab.id,
        name: lab.name,
        kind: ResourceKind.LAB,
        capacity: lab.capacity,
        timeZone: "Asia/Kolkata",
        active: true,
      },
    });
  }
  console.log(`5 Labs seeded with capacities: 20, 24, 24, 30, 12.`);

  // 4. Services (Service 3 MUST be Office Hours with Host 7)
  // Service 1: Quick Consultation
  await prisma.serviceType.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Quick Check-in",
      durationMins: 15,
      beforeBuffer: 5,
      afterBuffer: 5,
      seatsPerSlot: 1,
      hostId: 1,
      active: true,
    },
  });

  // Service 2: Standard Advising
  await prisma.serviceType.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "Academic Advising",
      durationMins: 30,
      beforeBuffer: 10,
      afterBuffer: 10,
      seatsPerSlot: 1,
      hostId: 2,
      active: true,
    },
  });

  // Service 3: KT-1 & PRD Benchmark: 45 min, before 15, after 30, Host 7
  await prisma.serviceType.upsert({
    where: { id: 3 },
    update: {
      hostId: 7,
      durationMins: 45,
      beforeBuffer: 15,
      afterBuffer: 30,
    },
    create: {
      id: 3,
      name: "Office Hours — Prof. Rao",
      durationMins: 45,
      beforeBuffer: 15,
      afterBuffer: 30,
      minNoticeMins: 0,
      seatsPerSlot: 1,
      hostId: 7,
      active: true,
    },
  });

  // Service 4: 3-Station Lab Session (for KT-3b test on Lab B)
  await prisma.serviceType.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: "Lab Station Workstation Session",
      durationMins: 60,
      beforeBuffer: 0,
      afterBuffer: 0,
      seatsPerSlot: 3, // Capacity 3 for KT-3b
      resourceId: 2, // Lab B
      active: true,
    },
  });
  console.log(`Services seeded (Service 3: Office Hours with Host 7).`);

  // 5. Availability Rules
  // Host 7 availability covering 2026-10-15: 09:00 to 17:00 IST
  // In addition, weekly rules Mon-Fri 09:00 - 17:00 IST
  const startTime = new Date("1970-01-01T09:00:00Z");
  const endTime = new Date("1970-01-01T17:00:00Z");

  await prisma.availabilityRule.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      kind: AvailabilityKind.DATE,
      ownerUserId: 7,
      date: new Date("2026-10-15T00:00:00Z"),
      startTime,
      endTime,
      note: "KT-1 verified date availability",
    },
  });

  await prisma.availabilityRule.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      kind: AvailabilityKind.WEEKLY,
      ownerUserId: 7,
      days: [1, 2, 3, 4, 5], // Mon to Fri
      startTime,
      endTime,
      note: "Standard office hours",
    },
  });

  // Lab B weekly availability (Mon-Fri 09:00 - 18:00)
  await prisma.availabilityRule.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      kind: AvailabilityKind.WEEKLY,
      ownerResourceId: 2,
      days: [1, 2, 3, 4, 5],
      startTime,
      endTime: new Date("1970-01-01T18:00:00Z"),
      note: "Lab B standard hours",
    },
  });

  // 6. 1 Term Holiday: 2026-10-20
  await prisma.availabilityRule.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      kind: AvailabilityKind.HOLIDAY,
      termId: 1,
      date: new Date("2026-10-20T00:00:00Z"),
      startTime: new Date("1970-01-01T00:00:00Z"),
      endTime: new Date("1970-01-01T23:59:59Z"),
      note: "Fall Midterm Break",
    },
  });
  console.log(`Availability rules and 1 Holiday (2026-10-20) seeded.`);

  // 7. 200 Students: IDs 101 to 300
  const studentData = [];
  for (let i = 1; i <= 200; i++) {
    const id = 100 + i;
    const pad = String(i).padStart(3, "0");
    studentData.push({
      id,
      name: `Student ${pad}`,
      email: `student_${pad}@meridian.edu`,
      role: Role.STUDENT,
      timeZone: "Asia/Kolkata",
    });
  }

  for (const s of studentData) {
    await prisma.user.upsert({
      where: { id: s.id },
      update: { name: s.name, email: s.email, role: s.role },
      create: s,
    });
  }
  console.log(`200 Students seeded (student_001 to student_200).`);

  // 8. Sample Student Commitment for D3 Clash Sentinel demonstration
  // Student 101 has a class on 2026-10-15 11:00-12:00 IST (05:30-06:30 UTC)
  await prisma.studentCommitment.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      studentId: 101,
      label: "CS3011 Advanced Algorithms Lecture",
      slotStart: new Date("2026-10-15T05:30:00Z"),
      slotEnd: new Date("2026-10-15T06:30:00Z"),
      source: "timetable",
    },
  });
  console.log(`Sample Student commitment seeded for D3 clash sentinel.`);

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
