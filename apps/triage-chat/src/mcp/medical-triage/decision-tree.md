# Health Sherpa triage decision tree

Quoted statements are example wording. The model words its own replies to fit the context.

Target population: 26-40 yo, no insurance

**Purpose:** Guide patients from symptom onset to the appropriate level of care. It is based on evidence-based principles from sources like the netCare service, CDC, and NHS, ensuring safe and practical guidance without providing a diagnosis.

## **Step 1: Check for Emergency Symptoms**

- **Question**: "Do you have any of the following emergency symptoms?"
  - Severe difficulty breathing
  - Chest pain
  - Sudden confusion
  - Severe headache
  - High fever (above 103°F)
  - Severe abdominal pain
  - Uncontrolled bleeding
  - Loss of consciousness
- **If Yes**: "This may be a medical emergency. Please seek care at your local Emergency Room or call 911 immediately."
- **If No**: Proceed to Step 2\.

## **Step 2: Gather Symptom Information**

- **Question 1**: "What are your main symptoms?"
  - Allow patients to describe symptoms or select from a list (e.g., cough, sore throat, fever, runny nose, muscle aches, fatigue, headache, chills, vomiting, diarrhea).
- **Question 2**: "When did these symptoms start?"
  - Options: Less than 3 days, 3-7 days, More than 7 days.
- **Question 3**: "How intense are your symptoms on a scale of 1-10 (1 \= mild, 10 \= severe)?"
- **Question 4**: "Have you been in contact with anyone sick lately, or has anyone near you had similar symptoms?"
  - Options: Yes, No, Unsure.

## **Step 3: Classify the Condition**

Based on the answers, classify the condition into one of four care levels using the following criteria:

| Care Level        | Criteria                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Emergent Care** | Any emergency symptoms (e.g., severe difficulty breathing, chest pain).                                                                                |
| **Urgent Care**   | High fever (\>100.4°F), severe cough, difficulty breathing (not severe), persistent vomiting (\>1 day), severe diarrhea (\>3 days), or intensity 8-10. |
| **Primary Care**  | Moderate symptoms (intensity 5-7), symptoms lasting \>3 days, or worsening symptoms without urgent criteria.                                           |
| **Self-Care**     | Mild symptoms (intensity 1-4), recent onset (\<3 days), no fever or urgent symptoms.                                                                   |

- **Emergency Care**: Direct to ER or 911\.
- **Urgent Care**: "Your symptoms may require prompt attention. Consider visiting an urgent care center or seeing a doctor today." _This is generally done within 24 hours._
- **Primary Care**: "Your symptoms may need medical attention, but it’s not an emergency. You should make an appointment with a primary care doctor." _This is generally done within 2 weeks_
- **Self-Care**: "Your symptoms seem mild and can likely be managed at home. Try rest, fluids, and over-the-counter medications. If symptoms worsen or persist, consider seeing a doctor."

## **Step 4: Provide Self-Care Guidance (if applicable)**

For self-care, provide general advice based on symptoms:

- **Cough/Sore Throat/Runny Nose**: Rest, stay hydrated, use over-the-counter cold remedies (e.g., decongestants, lozenges). Monitor for fever or worsening symptoms.
- **Fever**: Rest, fluids, acetaminophen or ibuprofen for fever. Seek care if fever exceeds 100.4°F or persists \>3 days.
- **Diarrhea/Vomiting**: Stay hydrated with water or electrolyte drinks, eat bland foods. Seek care if symptoms last \>3 days or include blood or severe pain.

_AI model Needs to search and cite reputable sites for ALL self-care/home-care advice given_

### **Key Citations**

- [Assessment of minor health disorders with decision tree-based triage](https://www.sciencedirect.com/science/article/pii/S1551741121002473)
- [Emergency Department Triage \- StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK557583/)
- [Triage \- Wikipedia](https://en.wikipedia.org/wiki/Triage)
- [Cold Versus Flu | CDC](https://www.cdc.gov/flu/about/coldflu.html)
- [A to Z list of common illnesses and conditions | NHS](https://www.nhsinform.scot/illnesses-and-conditions/a-to-z)
- [Common Illnesses | University Health Services](https://uhs.princeton.edu/health-resources/common-illnesses)
- [Symptom checker for digital self-triage | Self Care Decisions](https://www.selfcare.info/symptom-checker)
- [Evaluation of symptom checkers for self diagnosis and triage | BMJ](https://www.bmj.com/content/351/bmj.h3480)

#

# The following are to be assigned to the app’s chatbot, not the MCP.

_Can give patient option to still look for the cheapest available local care based on symptoms reported (e.g. if having cold symptoms, can make an appointment with an urgent care clinic with an availability within 24 hours)._

## **Step 5: Help Find Care using Pricing MCP from snowflake (if needed)**

- **Question**: "Do you have insurance, or would you like me to find care near you based on the cheapest cash pay price?"
  - **If Insurance**: "Let’s find a provider in your insurance network. What is your location?"
  - **If No Insurance**: "Let’s find the nearest available practitioner based on price and availability. What is your location?"
- Provide a direct link to schedule an appointment with a nearby provider based on **_price (e.g. cheapest cash pay)_** , **_location (within 5, 10 miles)_**, and **_availability (e.g. soonest)_**

## **Step 6: Prepare for Doctor Visits**

- Sherpa prepares an export that sorts out any questions the patient has and acts as an structure SBAR handoff sheet for the patient to show their provider
- _Health Sherpa can also gather basic demographics and medical history info and can help patient print it out to be able to give to staff to help with new patient establish intake_

####

####

# Comprehensive list of symptoms for each category, to anchor AI guidance

#### **Emergency Symptoms Requiring Emergency care:**

Emergency symptoms indicate a critical condition necessitating immediate evaluation, often via 911 or an ER visit. References below

- **Severe difficulty breathing** or shortness of breath, which may indicate respiratory distress or failure.
- **Chest pain or pressure**, especially if radiating to the arm, jaw, or back, suggestive of a heart attack.
- **Sudden confusion, slurred speech, or difficulty understanding speech**, often associated with stroke (use the FAST acronym: Face drooping, Arm weakness, Speech difficulty, Time to call 911).
- **Severe headache**, particularly if accompanied by vision changes, weakness, or confusion, potentially indicating a brain bleed or meningitis.
- **High fever**:
  - Above 103°F (39.4°C) in adults, which may signal severe infection.
  - Above 100.4°F (38°C) in infants under 3 months, as fevers in this age group can indicate serious infection.
- **Severe abdominal pain**, especially if sudden or accompanied by vomiting blood, possibly due to conditions like appendicitis or ectopic pregnancy.
- **Uncontrolled bleeding** or heavy bleeding that does not stop with pressure, such as from major trauma or internal hemorrhage.
- **Loss of consciousness** or fainting, which may indicate cardiac arrest, stroke, or severe hypoglycemia.
- **Seizures**, particularly first-time seizures, prolonged seizures (lasting over 5 minutes), or back-to-back seizures, indicating status epilepticus or neurological emergencies.
- **Sudden dizziness, weakness, or change in vision**, especially if severe or unexplained, potentially linked to stroke or vestibular issues.
- **Coughing up or vomiting blood**, which may indicate gastrointestinal bleeding or pulmonary hemorrhage.
- **Severe allergic reaction** (anaphylaxis), such as swelling of the face, lips, tongue, or throat, or difficulty breathing, requiring immediate epinephrine and ER care.
- **Head or spine injury**, especially if accompanied by confusion, fainting, or severe pain, suggesting traumatic brain injury or spinal cord damage.
- **Burns** that are large, deep, or involve critical areas like the face, hands, feet, groin, or major joints, indicating potential for infection or systemic complications.
- **Stroke symptoms**, including sudden numbness or weakness (especially on one side), severe headache, trouble speaking or understanding, vision loss, or loss of balance, necessitating urgent intervention (e.g., thrombolysis within 4.5 hours).
- **Heart attack symptoms**, such as chest discomfort, upper body pain, shortness of breath, cold sweat, nausea, or lightheadedness, requiring immediate ECG and treatment.
- **Severe or persistent vomiting**, especially if unable to keep down fluids or if blood is present, potentially indicating bowel obstruction or severe dehydration.
- **Sudden infant death syndrome (SIDS) symptoms** in babies, such as difficulty breathing or turning blue, requiring immediate pediatric ER care.
- **Poisoning or overdose**, including accidental ingestion of harmful substances, necessitating urgent decontamination or antidote administration.
- **Severe trauma** from accidents, falls, or assaults, especially if involving the head, neck, or spine, indicating potential for internal injuries or fractures.

These symptoms are supported by sources like [Cleveland Clinic](https://my.clevelandclinic.org/health/articles/medical-emergency), which emphasizes conditions like cauda equina syndrome (leg tingling or numbness risking paralysis) as emergencies, and [MedlinePlus](https://medlineplus.gov/ency/article/001927.htm), which lists sudden severe pain and seizures as critical.

#### **Urgent Care Symptoms Requiring Attention Within 24 Hours**

Urgent care symptoms are non-life-threatening but require prompt medical attention, often within 24 hours, and can typically be managed at urgent care centers or by primary care providers. The following list, derived from sources like Scripps Health and Aetna, includes:

- **Minor injuries**:
  - Cuts, burns, or sprains that are not severe, such as small lacerations or mild ankle sprains, suitable for suturing or splinting.
  - Minor fractures (if not displaced or causing severe pain), such as finger or toe fractures, which may need X-rays and casting.
- **Common illnesses**:
  - Colds, flu, ear infections, sore throats, or urinary tract infections, which may require antibiotics or symptomatic treatment.
- **Low-grade fevers**:
  - Below 103°F (39.4°C) in adults, often manageable with over-the-counter medications but warranting evaluation if persistent.
  - Below 100.4°F (38°C) in older children (over 3 months), typically indicating mild infection but needing monitoring.
- **Abdominal pain** that is not severe but persistent, possibly due to gastroenteritis or mild appendicitis, requiring evaluation to rule out serious causes.
- **Migraines or severe headaches** without other symptoms (e.g., no vision changes or weakness), which may need medication adjustment or imaging if recurrent.
- **Limited rashes or skin infections**, such as localized cellulitis or eczema flare-ups, often treatable with topical or oral antibiotics.
- **Dehydration** (mild to moderate, able to drink fluids), such as from vomiting or diarrhea, requiring IV fluids or oral rehydration if worsening.
- **Allergies** with mild to moderate symptoms (e.g., hives, itching, but no difficulty breathing), manageable with antihistamines but needing evaluation for triggers.
- **Dental problems**, such as toothaches or abscesses, requiring pain management and possible drainage or antibiotics.
- **Minor eye injuries or infections**, such as conjunctivitis (pink eye) or foreign body sensation, treatable with eye drops or removal.
- **STI symptoms** (if not severe, e.g., mild pain or discharge), requiring testing and treatment to prevent complications.
- **Mild asthma attacks** (if managed with an inhaler and not worsening), needing evaluation for adjustment of medication or monitoring.
- **Mild allergic reactions** (e.g., localized swelling or rash without difficulty breathing), treatable with antihistamines but requiring assessment for severity.

These symptoms are supported by [Healthline](https://www.healthline.com/health/right-care-right-time/know-before-you-go), which notes urgent care is ideal for minor, non-life-threatening issues, and [In and Out Urgent Care](https://inandouturgentcare.com/what-conditions-do-urgent-health-care-centers-treat/), which lists treatable conditions like minor fractures and UTIs.

#### **Special Considerations**

- **Infants and Children**: For infants under 3 months, any fever above 100.4°F (38°C) is considered an emergency, as per [Frisbie Memorial Hospital](https://frisbiehospital.com/blog/entry/12-symptoms-that-warrant-an-emergency-room-visit), due to the risk of serious infection.
- **Pregnant Women**: Symptoms like vaginal bleeding, severe abdominal pain, or reduced fetal movement may require emergency care, as noted in sources like [Minutes Matter (UPMC)](https://minutesmatter.upmc.com/know-the-signs-and-symptoms-of-an-emergency/).
- **Mental Health Emergencies**: While the focus is on physical symptoms, it's worth noting that suicidal thoughts or severe anxiety/panic attacks should prompt immediate help through crisis hotlines (e.g., 988 in the U.S.) or emergency services, as per [MedlinePlus](https://medlineplus.gov/ency/patientinstructions/000593.htm).

### **Key Citations**

- [Medical Emergencies: What To Know and How To React](https://my.clevelandclinic.org/health/articles/medical-emergency)
- [Recognizing medical emergencies](https://medlineplus.gov/ency/article/001927.htm)
- [7 Most Common Medical Emergencies](https://www.healthforteens.co.uk/health/in-an-emergency/7-most-common-medical-emergencies/)
- [Common Medical Emergencies](https://www.springvalleyhospital.com/services/emergency-department/common-medical-emergencies)
- [12 symptoms that warrant an emergency room visit](https://frisbiehospital.com/blog/entry/12-symptoms-that-warrant-an-emergency-room-visit)
- [Recognizing Signs and Symptoms of An Emergency](https://minutesmatter.upmc.com/know-the-signs-and-symptoms-of-an-emergency/)
- [Should You Go to the Emergency Room or Urgent Care?](https://www.scripps.org/news_items/4231-should-you-go-to-the-emergency-room-or-urgent-care)
- [Urgent Care vs ER vs Walk-in Clinic: Know When to Go](https://www.aetna.com/health-guide/medical-emergency-go-er-urgent-care.html)
- [6 Things to Know About Urgent Care Before You Go](https://www.healthline.com/health/right-care-right-time/know-before-you-go)
- [When to use the emergency room \- adult](https://medlineplus.gov/ency/patientinstructions/000593.htm)
- [Treatable Conditions at Urgent Health Care Centers](https://inandouturgentcare.com/what-conditions-do-urgent-health-care-centers-treat/)
- [Urgent vs. Emergency Care: What You Need to Know](https://www.stlukesonline.org/health-services/health-information/health-topics/urgent-vs-emergency-care)

# Legal Disclaimer Draft:

# **Health Sherpa Medical Disclaimer**

The Health Sherpa tool is provided for informational and educational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. The information provided is general in nature and is not tailored to your specific circumstances. Always seek the advice of your physician or other qualified healthcare provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read or seen on this tool.

The information provided by the Health Sherpa tool is not intended to create, and does not constitute, a doctor-patient relationship. The use of this tool does not establish any form of professional relationship between you and the providers of this tool.

While we strive to provide accurate and up-to-date information, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability with respect to the information, products, services, or related graphics contained on this tool for any purpose. Any reliance you place on such information is strictly at your own risk.

In no event will we be liable for any loss or damage, including without limitation, indirect or consequential loss or damage, or any loss or damage whatsoever arising from loss of data or profits arising out of, or in connection with, the use of this tool.

The Health Sherpa tool may provide links to third-party websites or services, including care providers. We do not endorse, control, or guarantee the quality, safety, or efficacy of any third-party services or providers. Your interactions with third-party providers are solely between you and such providers, and we are not responsible for any actions or inactions of such providers.

If you think you may have a medical emergency, call your doctor or 911 immediately. Do not rely on this tool for emergency medical care.
