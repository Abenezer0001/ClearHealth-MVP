import { db } from "./db";
import { sourceDocuments, exampleInputs, analyses, claims, citations, generatedOutputs } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  // Check if already seeded
  const existingSources = await db.select().from(sourceDocuments).limit(1);
  if (existingSources.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with trusted sources and examples...");

  // Seed trusted source documents
  const trustedSources = [
    {
      title: "Antibiotics: When they can and can't help",
      organization: "CDC",
      url: "https://www.cdc.gov/antibiotic-use/",
      content: "Antibiotics fight infections caused by bacteria. They do not work against infections caused by viruses, which cause colds, flu, most sore throats, bronchitis, and many sinus and ear infections. Taking antibiotics when they are not needed increases the risk of antibiotic resistance.",
      category: "antibiotics",
    },
    {
      title: "Vaccine Safety: Scientific Review",
      organization: "WHO",
      url: "https://www.who.int/vaccine_safety/en/",
      content: "Vaccines are thoroughly tested before being licensed for use. They continue to be monitored for safety after they are in use. Extensive research has shown no link between vaccines and autism. This claim originated from a fraudulent study that was retracted and the author lost their medical license.",
      category: "vaccines",
    },
    {
      title: "MMR Vaccine and Autism: The Evidence",
      organization: "CDC",
      url: "https://www.cdc.gov/vaccinesafety/",
      content: "Many studies have looked at whether there is a link between vaccines and autism spectrum disorder (ASD). None have found such a link. The evidence is clear: vaccines do not cause autism. This has been confirmed by multiple independent research groups worldwide.",
      category: "vaccines",
    },
    {
      title: "Common Cold: Treatment and Prevention",
      organization: "NHS",
      url: "https://www.nhs.uk/conditions/common-cold/",
      content: "There is no cure for a cold, and antibiotics will not help. Rest, drink plenty of fluids, and use over-the-counter remedies to ease symptoms. See a GP if symptoms worsen or don't improve after 3 weeks. Antibiotics are not effective against viral infections like the common cold.",
      category: "viral",
    },
    {
      title: "Type 1 Diabetes: Facts",
      organization: "NHS",
      url: "https://www.nhs.uk/conditions/type-1-diabetes/",
      content: "Type 1 diabetes is a lifelong condition where the pancreas doesn't produce insulin. It cannot be prevented and cannot be cured. It is not caused by lifestyle factors. People with type 1 diabetes need insulin injections to survive. Diet alone cannot cure or reverse type 1 diabetes.",
      category: "chronic",
    },
    {
      title: "Blood Pressure Medication Guidelines",
      organization: "CDC",
      url: "https://www.cdc.gov/bloodpressure/",
      content: "High blood pressure usually has no symptoms. Blood pressure medication helps keep blood pressure at a healthy level but does not cure hypertension. Stopping medication without medical guidance can cause blood pressure to rise again, increasing risk of heart attack and stroke.",
      category: "chronic",
    },
    {
      title: "Infant Feeding and Hydration",
      organization: "WHO",
      url: "https://www.who.int/health-topics/infant-nutrition",
      content: "Babies under 6 months should be exclusively breastfed or given infant formula. They should not be given water, as their kidneys are not mature enough. Even in hot weather, breast milk or formula provides all the hydration needed. Giving water to young infants can be dangerous.",
      category: "pediatrics",
    },
    {
      title: "Cancer Treatment: Evidence-Based Approaches",
      organization: "WHO",
      url: "https://www.who.int/health-topics/cancer",
      content: "Cancer treatment should be based on scientific evidence. There is no proven 'natural cure' or special diet that can cure cancer. Treatments like chemotherapy, radiation, and surgery have been proven effective through rigorous clinical trials. Delaying proven treatment in favor of unproven alternatives can be life-threatening.",
      category: "cancer",
    },
    {
      title: "Essential Oils: Safety Information",
      organization: "NHS",
      url: "https://www.nhs.uk/",
      content: "Essential oils should not be used as a substitute for prescribed medications or medical treatment. They are not antibiotics and cannot treat bacterial infections. Some essential oils can cause skin irritation or allergic reactions. Always consult a healthcare provider before using essential oils for health purposes.",
      category: "alternative",
    },
    {
      title: "COVID-19 Vaccine Safety",
      organization: "WHO",
      url: "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/covid-19-vaccines",
      content: "COVID-19 vaccines do not modify your DNA. mRNA vaccines work by teaching cells to make a protein that triggers an immune response. The mRNA never enters the cell nucleus where DNA is stored. After the immune response is triggered, the mRNA breaks down and is eliminated by the body.",
      category: "vaccines",
    },
  ];

  for (const source of trustedSources) {
    await db.insert(sourceDocuments).values(source);
  }

  // Seed example inputs for demo mode
  const examples = [
    {
      title: "Antibiotics for Cold",
      content: "You should take antibiotics when you have a cold. They'll help you get better faster and prevent it from getting worse.",
      category: "antibiotics",
      expectedSeverity: "high",
    },
    {
      title: "Vaccines and Autism",
      content: "Studies have proven that childhood vaccines, especially MMR, cause autism in children. Many parents have noticed changes in their children after vaccination.",
      category: "vaccines",
      expectedSeverity: "high",
    },
    {
      title: "Miracle Cancer Cure",
      content: "Drinking alkaline water and taking high-dose vitamin C can cure any type of cancer naturally without chemotherapy or radiation.",
      category: "cancer",
      expectedSeverity: "critical",
    },
    {
      title: "Blood Pressure Medication",
      content: "Once your blood pressure is normal on medication, you can stop taking it because you're cured. The medication fixed the underlying problem.",
      category: "chronic",
      expectedSeverity: "high",
    },
    {
      title: "Baby Hydration",
      content: "Babies under 6 months should drink extra water, especially in hot weather, to prevent dehydration.",
      category: "pediatrics",
      expectedSeverity: "high",
    },
  ];

  for (const example of examples) {
    await db.insert(exampleInputs).values(example);
  }

  // Seed some sample analyses for demo
  const sampleAnalysis = await db.insert(analyses).values({
    inputType: "text",
    inputText: "Taking antibiotics for a cold or flu will help you recover faster.",
    region: "WHO",
    tone: "neutral",
    audience: "general",
    platform: "general",
    status: "done",
    overallSeverity: "high",
    redFlagsDetected: false,
    redFlags: [],
    topics: ["antibiotics", "viral infections"],
    disclaimer: "This information is for educational purposes only. Consult a healthcare provider for medical advice.",
    whatIsWrong: "Antibiotics are only effective against bacterial infections. Colds and flu are caused by viruses, which antibiotics cannot treat.",
    whatWeKnow: "Research consistently shows that antibiotics do not help with viral infections like colds and flu. Taking antibiotics unnecessarily contributes to antibiotic resistance.",
    whatToDo: "Rest, stay hydrated, and use over-the-counter remedies for symptom relief. Give your immune system time to fight the virus naturally.",
    whenToSeekCare: "See a doctor if symptoms worsen, last more than 10 days, or if you develop high fever, difficulty breathing, or severe symptoms.",
    completedAt: new Date(),
  }).returning();

  if (sampleAnalysis.length > 0) {
    const analysisId = sampleAnalysis[0].id;

    // Add sample claim
    const sampleClaim = await db.insert(claims).values({
      analysisId,
      claimText: "Taking antibiotics for a cold or flu will help you recover faster",
      claimType: "medical_advice",
      topic: "antibiotics",
      targetPopulation: "general",
      urgencyHint: "low",
      potentialHarm: "high",
      certaintyInText: 80,
      stance: "contradicted",
      stanceConfidence: 95,
      stanceExplanation: "This claim is contradicted by medical evidence. Antibiotics only work against bacteria, not viruses.",
      severity: "high",
      riskReason: "Could lead to unnecessary antibiotic use and contribute to antibiotic resistance",
    }).returning();

    if (sampleClaim.length > 0) {
      await db.insert(citations).values({
        claimId: sampleClaim[0].id,
        sourceOrg: "CDC",
        sourceTitle: "Antibiotics: When they can and can't help",
        sourceUrl: "https://www.cdc.gov/antibiotic-use/",
        snippet: "Antibiotics fight bacteria, not viruses. They do not work against colds, flu, or most sore throats.",
        relevance: 95,
      });
    }

    // Add sample outputs
    const outputContents = [
      { format: "social_reply", length: "short", content: "Actually, antibiotics don't work against colds and flu - they're caused by viruses. Rest and fluids are your best bet! [1]" },
      { format: "social_reply", length: "medium", content: "Common misconception! Antibiotics only work against bacteria, not viruses like those causing colds and flu. Using antibiotics unnecessarily can contribute to antibiotic resistance. Rest, stay hydrated, and your immune system will do the work. See a doctor if symptoms persist over 10 days. [1]" },
      { format: "social_reply", length: "long", content: "I understand wanting to feel better quickly! However, antibiotics are designed to fight bacteria, not viruses. Colds and flu are viral infections, so antibiotics won't help and could actually cause harm through side effects and contributing to antibiotic resistance.\n\nWhat actually helps:\n- Rest and sleep\n- Plenty of fluids\n- Over-the-counter symptom relievers\n- Honey for coughs (for adults and children over 1)\n\nSee a doctor if: symptoms worsen, fever is very high, or you have difficulty breathing. [1]" },
      { format: "handout", length: "short", content: "FACT CHECK: Antibiotics Don't Work on Colds or Flu\n\nAntibiotics fight bacteria, not viruses. Since colds and flu are viral, antibiotics won't help you recover faster.\n\nWhat helps: Rest, fluids, and time.\nWhen to see a doctor: If symptoms worsen or last over 10 days.\n\nSource: CDC [1]" },
      { format: "handout", length: "medium", content: "PATIENT INFORMATION: Antibiotics and Viral Infections\n\nWhy Antibiotics Don't Work for Colds and Flu\n\nAntibiotics are powerful medicines that fight bacterial infections. However, colds and flu are caused by viruses, not bacteria. Taking antibiotics for viral infections:\n- Won't help you feel better faster\n- Won't prevent the infection from spreading\n- May cause side effects\n- Contributes to antibiotic resistance\n\nWhat You Can Do Instead:\n- Get plenty of rest\n- Drink lots of fluids\n- Use over-the-counter medicines for symptoms\n- Try honey for coughs (if over 1 year old)\n\nWhen to Seek Medical Care:\n- Symptoms worsen after 7 days\n- High fever that doesn't respond to medication\n- Difficulty breathing or chest pain\n- Symptoms last more than 10 days\n\nSource: CDC Guidelines [1]" },
      { format: "handout", length: "long", content: "COMPREHENSIVE PATIENT GUIDE: Understanding Antibiotics and Viral Infections\n\n--- THE FACTS ---\n\nAntibiotics are medicines designed to kill or stop the growth of bacteria. They are one of modern medicine's most important tools for fighting bacterial infections.\n\nHowever, colds, flu, and most respiratory infections are caused by VIRUSES, not bacteria. Antibiotics have absolutely no effect on viruses.\n\n--- WHY THIS MATTERS ---\n\nWhen antibiotics are used unnecessarily:\n1. You don't get better any faster\n2. You may experience side effects (nausea, diarrhea, allergic reactions)\n3. Bacteria in your body can develop resistance\n4. Antibiotic-resistant infections are harder to treat and can be life-threatening\n\n--- WHAT ACTUALLY HELPS ---\n\nFor colds and flu, focus on:\n- Rest: Your body needs energy to fight the infection\n- Hydration: Water, herbal teas, broths\n- Symptom relief: Over-the-counter pain relievers, decongestants\n- Humidity: Steam or a humidifier can ease congestion\n- Honey: Natural cough suppressant (not for children under 1)\n\n--- WHEN TO SEE A DOCTOR ---\n\nSeek medical attention if:\n- Symptoms get worse after initially improving\n- High fever (over 103°F/39.4°C) lasting more than 3 days\n- Severe headache or facial pain\n- Difficulty breathing or chest pain\n- Symptoms persist beyond 10 days\n- You have underlying health conditions\n\nYour doctor will determine if a bacterial infection is present and antibiotics are truly needed.\n\n--- REMEMBER ---\n\nAsking for antibiotics when they're not needed puts you and others at risk. Trust your healthcare provider's judgment about the best treatment for your illness.\n\nSources: CDC, WHO [1]" },
      { format: "clinician_note", length: "short", content: "Patient inquiry re: antibiotics for viral URI. Claim contradicted per CDC guidelines. Recommend supportive care, return precautions for bacterial superinfection signs." },
      { format: "clinician_note", length: "medium", content: "CLINICAL NOTE - Antibiotic Stewardship\n\nPatient Concern: Belief that antibiotics effective for viral URI/influenza\n\nEvidence Review: Per CDC antibiotic stewardship guidelines, antibiotics have no efficacy against viral pathogens. Unnecessary antibiotic use associated with C. difficile risk, resistance development, and adverse drug reactions.\n\nRecommendation: Patient education on viral vs bacterial infection differentiation. Supportive care measures (rest, hydration, OTC symptom management). Return precautions: worsening symptoms, high persistent fever, respiratory distress, symptoms >10 days suggesting bacterial superinfection.\n\nRef: CDC Antibiotic Use Guidelines [1]" },
      { format: "clinician_note", length: "long", content: "CLINICAL NOTE - Antibiotic Stewardship and Patient Education\n\nPresenting Concern:\nPatient presents with belief that antibiotics are effective treatment for common cold/influenza-like illness.\n\nClinical Context:\nThis represents a common misconception that contributes to inappropriate antibiotic utilization and antimicrobial resistance development.\n\nEvidence Summary:\nPer CDC antibiotic stewardship guidelines:\n- Antibiotics target bacterial cell wall synthesis, protein synthesis, or DNA replication\n- Viral pathogens (rhinovirus, influenza, RSV, coronavirus) lack these bacterial structures\n- Meta-analyses confirm no clinical benefit of antibiotics in uncomplicated viral URI\n- NNH for adverse events with unnecessary antibiotics: ~20 patients\n\nPatient Education Points:\n1. Viral vs bacterial etiology differentiation\n2. Natural history of uncomplicated viral URI (7-10 days)\n3. Evidence-based symptomatic management\n4. Antibiotic resistance as public health concern\n5. Appropriate indications for follow-up evaluation\n\nRecommended Management:\n- Supportive care: adequate hydration, rest, antipyretics PRN\n- OTC symptom management: decongestants, antihistamines, cough suppressants as appropriate\n- Consider honey for cough (age >1 year)\n- Humidification for congestion relief\n\nReturn Precautions (suggestive of bacterial complication):\n- Worsening symptoms after initial improvement (biphasic illness)\n- High fever (>39°C) persisting >3 days\n- Severe unilateral facial pain (sinusitis)\n- Purulent nasal discharge >10 days\n- Respiratory distress or hypoxia\n- Signs of pneumonia\n\nAntibiotic Prescribing Decision:\nDelayed prescribing strategy may be considered for select patients - provide prescription with instructions to fill only if specific criteria met after 48-72 hours. However, for uncomplicated viral URI without bacterial risk factors, no antibiotic indicated.\n\nReferences: CDC Antibiotic Prescribing Guidelines, IDSA Acute Respiratory Infection Guidelines [1]" },
    ];

    for (const output of outputContents) {
      await db.insert(generatedOutputs).values({
        analysisId,
        format: output.format,
        length: output.length,
        content: output.content,
      });
    }
  }

  console.log("Database seeded successfully!");
}
