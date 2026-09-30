using Syncfusion.DocIO;
using Syncfusion.DocIO.DLS;

namespace ContractWorkspace.TemplateGenerator;

static class LicenseBootstrap
{
    public static void Register()
    {
        var key = Environment.GetEnvironmentVariable("SYNCFUSION_LICENSE_KEY_v34")
                  ?? Environment.GetEnvironmentVariable("SYNCFUSION_LICENSE_KEY")
                  ?? string.Empty;
        Syncfusion.Licensing.SyncfusionLicenseProvider.RegisterLicense(key);
    }
}

/// <summary>
/// One-shot gene/// One-shot generator that authors the showcase template DOCX files under the
/// document service <c>wwwroot/Templates</c> directory. Each template embeds
/// real Word <c>MERGEFIELD</c> fields (rendered as <c>«Field»</c>) — never
/// literal <c>{{Token}}</c> text — so the fields are discoverable via DocIO
/// <c>GetMergeFieldNames()</c> and fillable server-side through
/// <c>MailMerge.Execute(...)</c>. Alongside the merge fields each template
/// carries bookmark anchors for its title, recital, three clause slots
/// (<c>Slot_Xy</c> label + <c>SlotBody_Slot_Xy</c> body that clause insertion
/// replaces in place) and a signature-block placeholder — aligned with the
/// SOP Manager domain model and the 3-step workflow story.
///
/// Canonical merge-field set per template (single source of truth):
///   Mutual NDA        → CompanyName, CustomerContact, EffectiveDate,
///                       ContractValue, Jurisdiction, TermMonths
///   Service Agreement → CompanyName, CustomerContact, EffectiveDate,
///                       ContractValue, CompanyRegion, PaymentTerms
///   Purchase Contract → CompanyName, CustomerContact, EffectiveDate,
///                       ContractValue, DeliveryDate, WarrantyPeriod
///   Healthcare SOP    → CompanyName, CustomerContact, EffectiveDate,
///                       DepartmentName, ProcedureCode, ReviewCycle
///   Laboratory SOP    → CompanyName, CustomerContact, EffectiveDate,
///                       TestMethod, Accreditation, ReviewCycle
///   Manufacturing SOP → CompanyName, CustomerContact, EffectiveDate,
///                       ProductLine, EquipmentName, ReviewCycle
///
/// Run <c>dotnet run --project src/ContractWorkspace.TemplateGenerator</c>
/// from the <c>server-side</c> directory after building the solution to
/// regenerate the assets.
/// </summary>
public static class Program
{
    // Typographic characters used in the clause text.
    private const string LQuote = "“"; // “
    private const string RQuote = "”"; // ”
    private const string Apos = "’";   // ’

    private static readonly string OutputPath = Path.Combine(
        AppContext.BaseDirectory,
        "..", "..", "..", "..",
        "ContractWorkspace.DocumentService", "wwwroot", "Templates");

    public static void Main()
    {
        LicenseBootstrap.Register();
        Directory.CreateDirectory(OutputPath);

        CreateMutualNda(Path.Combine(OutputPath, "MutualNDA.docx"));
        CreateServiceAgreement(Path.Combine(OutputPath, "ServiceAgreement.docx"));
        CreatePurchaseContract(Path.Combine(OutputPath, "PurchaseContract.docx"));
        CreateHealthcareSop(Path.Combine(OutputPath, "HealthcareSOP.docx"));
        CreateLaboratorySop(Path.Combine(OutputPath, "LaboratorySOP.docx"));
        CreateManufacturingSop(Path.Combine(OutputPath, "ManufacturingSOP.docx"));

        Console.WriteLine($"Templates generated at: {Path.GetFullPath(OutputPath)}");
    }

    private static void CreateMutualNda(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Mutual Non-Disclosure Agreement", "Title_nda");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Disclosing Party: ", "CompanyName");
        AddFieldLine(section, "Receiving Party: ", "CustomerContact");
        section.AddParagraph();

        AddBookmark(section, "Background", paragraph =>
        {
            paragraph.AppendText($"This Mutual Non-Disclosure Agreement (the {LQuote}Agreement{RQuote}) is entered into as of ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" by and between ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText(" and ");
            paragraph.AppendField("CustomerContact", FieldType.FieldMergeField);
            paragraph.AppendText(", in connection with a prospective engagement valued at approximately ");
            paragraph.AppendField("ContractValue", FieldType.FieldMergeField);
            paragraph.AppendText($". Each party may disclose confidential and proprietary information to the other (the {LQuote}Confidential Information{RQuote}) solely to evaluate that opportunity.");
        });

        AddClauseSlot(section, "Confidentiality", "Slot_Confidentiality", paragraph =>
        {
            paragraph.AppendText($"Each party shall hold the other party{Apos}s Confidential Information in strict confidence, use it only to evaluate the contemplated relationship, and disclose it exclusively to representatives with a need to know who are bound by obligations of confidentiality no less protective than those set out in this Agreement.");
        });

        AddClauseSlot(section, "Exclusions", "Slot_Exclusions", paragraph =>
        {
            paragraph.AppendText("Confidential Information does not include information that is or becomes publicly available through no fault of the receiving party, was lawfully known to the receiving party before disclosure, is independently developed without use of the disclosing party" + Apos + "s Confidential Information, or is rightfully obtained from a third party without a duty of confidentiality.");
        });

        AddClauseSlot(section, "Term", "Slot_Term", paragraph =>
        {
            paragraph.AppendText("This Agreement remains in effect for ");
            paragraph.AppendField("TermMonths", FieldType.FieldMergeField);
            paragraph.AppendText(" months from the Effective Date. The confidentiality obligations survive for three (3) years following the return or destruction of all Confidential Information, and upon written request the receiving party shall promptly return or destroy such materials.");
        });

        AddLabeledClause(section, "Governing Law", paragraph =>
        {
            paragraph.AppendText("This Agreement is governed by and construed in accordance with the laws of ");
            paragraph.AppendField("Jurisdiction", FieldType.FieldMergeField);
            paragraph.AppendText(", without regard to its conflict-of-laws principles. The parties" + Apos + " sole remedy for breach includes injunctive relief in addition to any other remedies available at law or in equity.");
        });

        AddSignatureBlock(section, "SignatureBlock_Nda");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreateServiceAgreement(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Master Service Agreement", "Title_service");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Service Provider: ", "CompanyName");
        AddFieldLine(section, "Client: ", "CustomerContact");
        AddFieldLine(section, "Account Region: ", "CompanyRegion");
        section.AddParagraph();

        AddBookmark(section, "Scope", paragraph =>
        {
            paragraph.AppendText("Under this Master Service Agreement, ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Provider{RQuote}) shall perform the professional services described in each mutually executed Statement of Work for ");
            paragraph.AppendField("CustomerContact", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Client{RQuote}). This Agreement takes effect on ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" and governs every Statement of Work executed under it.");
        });

        AddClauseSlot(section, "Fees & Payment", "Slot_Payment", paragraph =>
        {
            paragraph.AppendText("In consideration of the services, Client shall pay Provider fees totaling ");
            paragraph.AppendField("ContractValue", FieldType.FieldMergeField);
            paragraph.AppendText(". Invoices are due and payable ");
            paragraph.AppendField("PaymentTerms", FieldType.FieldMergeField);
            paragraph.AppendText(" from the invoice date. Undisputed amounts that remain unpaid when due accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower.");
        });

        AddClauseSlot(section, "Liability", "Slot_Liability", paragraph =>
        {
            paragraph.AppendText("Except for breaches of confidentiality or a party" + Apos + "s indemnification obligations, each party" + Apos + "s aggregate liability under this Agreement is limited to the fees paid or payable during the twelve (12) months preceding the event giving rise to the claim, and neither party is liable for indirect, incidental, or consequential damages.");
        });

        AddClauseSlot(section, "Termination", "Slot_Termination", paragraph =>
        {
            paragraph.AppendText("Either party may terminate this Agreement or any Statement of Work for convenience upon thirty (30) days" + Apos + " written notice, or immediately for a material breach that remains uncured fifteen (15) days after written notice. Upon termination, Client shall pay for all services performed through the effective date of termination.");
        });

        AddSignatureBlock(section, "SignatureBlock_Service");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreatePurchaseContract(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Purchase Contract", "Title_purchase");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Seller: ", "CompanyName");
        AddFieldLine(section, "Buyer Contact: ", "CustomerContact");
        AddFieldLine(section, "Total Order Value: ", "ContractValue");
        section.AddParagraph();

        AddBookmark(section, "Goods", paragraph =>
        {
            paragraph.AppendText("This Purchase Contract is entered into as of ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" between ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Seller{RQuote}) and ");
            paragraph.AppendField("CustomerContact", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Buyer{RQuote}) for the purchase of the goods itemized in the exhibit attached hereto, for total consideration of ");
            paragraph.AppendField("ContractValue", FieldType.FieldMergeField);
            paragraph.AppendText(", exclusive of applicable taxes and duties.");
        });

        AddClauseSlot(section, "Delivery", "Slot_Delivery", paragraph =>
        {
            paragraph.AppendText("Seller shall deliver the goods to Buyer" + Apos + "s designated address on or before ");
            paragraph.AppendField("DeliveryDate", FieldType.FieldMergeField);
            paragraph.AppendText(", freight prepaid, with risk of loss passing to Buyer upon delivery. Buyer may inspect the goods within ten (10) business days of receipt and reject any non-conforming items for prompt replacement.");
        });

        AddClauseSlot(section, "Warranty", "Slot_Warranty", paragraph =>
        {
            paragraph.AppendText("Seller warrants that the goods will be free from defects in material and workmanship and will conform to the agreed specifications for a period of ");
            paragraph.AppendField("WarrantyPeriod", FieldType.FieldMergeField);
            paragraph.AppendText(" from the delivery date. Buyer" + Apos + "s exclusive remedy for breach of this warranty is the repair or replacement of the defective goods at Seller" + Apos + "s expense.");
        });

        AddClauseSlot(section, "Data Protection", "Slot_DataProtection", paragraph =>
        {
            paragraph.AppendText("Each party shall comply with all applicable data protection and privacy laws in connection with any personal data exchanged under this Contract, and shall implement appropriate technical and organizational measures to safeguard such data against unauthorized access or disclosure.");
        });

        AddSignatureBlock(section, "SignatureBlock_Purchase");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreateHealthcareSop(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Standard Operating Procedure — Patient Care Services", "Title_healthcare");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Issuing Organization: ", "CompanyName");
        AddFieldLine(section, "Responsible Department: ", "DepartmentName");
        AddFieldLine(section, "Procedure Owner: ", "CustomerContact");
        AddFieldLine(section, "CPT / HCPCS Code: ", "ProcedureCode");
        section.AddParagraph();

        AddBookmark(section, "Purpose", paragraph =>
        {
            paragraph.AppendText("This Standard Operating Procedure (the " + LQuote + "SOP" + RQuote + ") establishes the minimum requirements for delivering patient care services within the ");
            paragraph.AppendField("DepartmentName", FieldType.FieldMergeField);
            paragraph.AppendText(" department of ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText(" (the " + LQuote + "Organization" + RQuote + "). It defines the responsibilities, controls, and documentation expected of every clinical and administrative staff member who performs or supports the procedure under CPT/HCPCS code ");
            paragraph.AppendField("ProcedureCode", FieldType.FieldMergeField);
            paragraph.AppendText(", and is effective from ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" until superseded or formally retired by the Quality and Compliance Office.");
        });

        AddBookmark(section, "Scope", paragraph =>
        {
            paragraph.AppendText("This SOP applies to all physicians, registered nurses, advanced practice providers, medical assistants, and ancillary personnel employed by, contracted with, or privileged at the Organization who are involved in the scheduling, performance, supervision, billing, or follow-up of the procedure. It also applies to telehealth encounters conducted under the originating-site and distant-site requirements of 42 CFR §410.78 where the patient is physically located in a jurisdiction where the rendering provider is licensed to practice.");
        });

        AddBookmark(section, "Definitions", paragraph =>
        {
            paragraph.AppendText("For the purposes of this SOP, " + LQuote + "Adverse Event" + RQuote + " means any untoward medical occurrence that may present during or following the procedure and that requires intervention, documentation, or escalation. " + LQuote + "Order" + RQuote + " means a written, electronic, or verbal directive issued by a privileged provider that authorizes the performance of the procedure for a specific patient. " + LQuote + "Time-Out" + RQuote + " means the pre-procedural verification conducted with the entire clinical team to confirm patient identity, procedure, and site/side.");
        });

        AddLabeledClause(section, "Regulatory References", paragraph =>
        {
            paragraph.AppendText("This SOP is issued in alignment with the Centers for Medicare & Medicaid Services (CMS) Conditions of Participation, The Joint Commission standards for ambulatory and hospital-based care, the Health Insurance Portability and Accountability Act (HIPAA) Privacy and Security Rules (45 CFR Parts 160 and 164), and applicable state board of medicine, nursing, and pharmacy regulations. The procedure owner is responsible for verifying the current edition of every cited reference at each scheduled review.");
        });

        AddClauseSlot(section, "Pre-Procedure Requirements", "Slot_PreProcedure", paragraph =>
        {
            paragraph.AppendText("Prior to initiating the procedure, the rendering clinician shall verify patient identity using two identifiers per The Joint Commission " + LQuote + "National Patient Safety Goals" + RQuote + ", confirm a signed and dated Order, document a pertinent history and physical within thirty (30) days of the encounter, and obtain informed consent. The clinical team shall reconcile the patient" + Apos + "s current medication list against the Organization" + Apos + "s active medication record, document any known allergies and adverse reactions, and confirm the procedure is consistent with the patient" + Apos + "s advance directive when an advance directive is on file.");
        });

        AddClauseSlot(section, "Procedure Steps", "Slot_ProcedureSteps", paragraph =>
        {
            paragraph.AppendText("Following the pre-procedure verification, the rendering clinician shall perform a Time-Out with all members of the immediate care team to confirm patient identity, planned procedure, and laterality where applicable. The procedure shall then be performed in accordance with the manufacturer" + Apos + "s Instructions for Use, peer-reviewed clinical practice guidelines, and any procedure-specific checklist maintained in the Organization" + Apos + "s clinical content management system. Vital signs, sedation depth (where applicable), and the patient" + Apos + "s tolerance of the procedure shall be documented at intervals consistent with the patient" + Apos + "s condition.");
        });

        AddClauseSlot(section, "Post-Procedure & Documentation", "Slot_PostProcedure", paragraph =>
        {
            paragraph.AppendText("Upon completion of the procedure, the rendering clinician shall dictate or otherwise document an operative note that includes the pre-operative and post-operative diagnoses, the procedure performed, findings, specimens collected, estimated blood loss (where applicable), complications, and the disposition of the patient. The note shall be entered into the electronic health record within twenty-four (24) hours of the encounter. Discharge instructions shall be provided in the patient" + Apos + "s primary language and shall include return precautions, follow-up appointments, and a contact number for after-hours clinical questions.");
        });

        AddClauseSlot(section, "Adverse Event Reporting", "Slot_AdverseEvent", paragraph =>
        {
            paragraph.AppendText("Any Adverse Event that occurs during, or is identified within thirty (30) days following, the procedure shall be documented in the safety event reporting system within twenty-four (24) hours of discovery and shall be escalated to the procedure owner and the Organization" + Apos + "s Risk Management department. Events that meet the FDA MedWatch criteria for a serious or unexpected adverse event shall additionally be reported to the manufacturer and the U.S. Food and Drug Administration in accordance with 21 CFR Part 803. Suspected healthcare-associated infections shall be reported to the Infection Prevention and Control team in accordance with the Organization" + Apos + "s infection surveillance plan.");
        });

        AddClauseSlot(section, "Quality Monitoring", "Slot_Quality", paragraph =>
        {
            paragraph.AppendText("The procedure owner, in coordination with the Quality and Compliance Office, shall review adherence to this SOP on a " + LQuote + "quarterly" + RQuote + " cycle, or more frequently when a sentinel event, regulatory update, or material change in clinical practice warrants. Indicators shall include, at minimum, the rate of completed Time-Out documentation, the rate of operative-note completion within twenty-four (24) hours, the rate of Adverse Events per 100 procedures, and the rate of patient complaints related to consent or communication. Results shall be reported to the Medical Executive Committee at each regularly scheduled meeting.");
        });

        AddLabeledClause(section, "Review Cycle", paragraph =>
        {
            paragraph.AppendText("This SOP shall be reviewed at minimum every ");
            paragraph.AppendField("ReviewCycle", FieldType.FieldMergeField);
            paragraph.AppendText(" by the procedure owner and the Quality and Compliance Office. Each review shall confirm alignment with current regulatory and accreditation requirements, document any deviation between written procedure and observed practice, and result in a version-controlled revision that is communicated to all affected staff through the Organization" + Apos + "s learning management system. The procedure owner is responsible for initiating the review on or before the anniversary of the effective date.");
        });

        AddSignatureBlock(section, "SignatureBlock_Healthcare");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreateLaboratorySop(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Standard Operating Procedure — Laboratory Test Method", "Title_laboratory");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Testing Laboratory: ", "CompanyName");
        AddFieldLine(section, "Method Author / Reviewer: ", "CustomerContact");
        AddFieldLine(section, "Test Method Identifier: ", "TestMethod");
        AddFieldLine(section, "Accreditation Scope: ", "Accreditation");
        section.AddParagraph();

        AddBookmark(section, "Purpose", paragraph =>
        {
            paragraph.AppendText("This Standard Operating Procedure (the " + LQuote + "SOP" + RQuote + ") defines the technical procedure, controls, and quality assurance requirements for performing test method ");
            paragraph.AppendField("TestMethod", FieldType.FieldMergeField);
            paragraph.AppendText(" at the testing laboratory operated by ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText(" (the " + LQuote + "Laboratory" + RQuote + "). The SOP is effective from ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" and is issued to ensure that every result reported by the Laboratory is scientifically valid, traceable to documented reference standards, and defensible under audit by the accreditation body identified below.");
        });

        AddBookmark(section, "Scope", paragraph =>
        {
            paragraph.AppendText("This SOP applies to all analytical work performed under test method " );
            paragraph.AppendField("TestMethod", FieldType.FieldMergeField);
            paragraph.AppendText(", including sample receipt and login, reagent and standard preparation, instrument calibration and verification, sample analysis, data reduction, result review and approval, and the release of the test report to the client. It applies to the Laboratory" + Apos + "s primary site and to any satellite, mobile, or remote facility operating under the same quality system. Where the Laboratory subcontracts any portion of the work, the subcontracting laboratory shall be ISO/IEC 17025 accredited for the subcontracted activity and the subcontracting arrangement shall be documented in the case file.");
        });

        AddBookmark(section, "References", paragraph =>
        {
            paragraph.AppendText("This SOP is issued in alignment with ISO/IEC 17025:2017 " + LQuote + "General requirements for the competence of testing and calibration laboratories" + RQuote + ", the U.S. Pharmacopeia General Chapter <1220> " + LQuote + "The Analytical Procedure Lifecycle" + RQuote + " where the method supports a regulated product, and the published reference method on which test method ");
            paragraph.AppendField("TestMethod", FieldType.FieldMergeField);
            paragraph.AppendText(" is based. Where regulatory or compendial requirements conflict with this SOP, the more stringent requirement shall apply and the deviation shall be documented in the Laboratory" + Apos + "s deviation log.");
        });

        AddLabeledClause(section, "Accreditation", paragraph =>
        {
            paragraph.AppendText("This SOP supports the Laboratory" + Apos + "s accreditation under ");
            paragraph.AppendField("Accreditation", FieldType.FieldMergeField);
            paragraph.AppendText(". The Laboratory shall not claim accreditation for the test method unless the scope of accreditation expressly includes the analyte, matrix, and technique described in this SOP, and the analyst performing the work has been qualified and is current on the proficiency-testing program for the method.");
        });

        AddClauseSlot(section, "Sample Receipt & Acceptance", "Slot_SampleReceipt", paragraph =>
        {
            paragraph.AppendText("Samples shall be received and logged in the Laboratory Information Management System (LIMS) with a unique accession identifier. Each sample shall be inspected against the acceptance criteria defined in the Laboratory" + Apos + "s sample acceptance policy, including container integrity, sample temperature on receipt (where temperature control is required), chain-of-custody completeness, and holding-time compliance. Samples that do not meet acceptance criteria shall be rejected or qualified in writing prior to analysis, and the disposition shall be communicated to the client within one (1) business day.");
        });

        AddClauseSlot(section, "Reagents, Standards & Reference Materials", "Slot_Reagents", paragraph =>
        {
            paragraph.AppendText("All reagents, calibration standards, and certified reference materials shall be received with a manufacturer" + Apos + "s Certificate of Analysis that is reviewed and filed in the LIMS. Reagents and standards shall be stored under the conditions specified by the manufacturer, shall be assigned an expiration date no later than the earliest manufacturer" + Apos + "s expiration among any component, and shall be discarded at expiration or upon evidence of deterioration, whichever is earlier. Working standards shall be prepared from certified reference materials using Class A volumetric glassware or calibrated pipettes, and each preparation shall be witnessed and counter-signed by a second qualified analyst.");
        });

        AddClauseSlot(section, "Calibration & Quality Control", "Slot_Calibration", paragraph =>
        {
            paragraph.AppendText("Prior to each analytical batch, the analyst shall perform an instrument calibration using a minimum of five calibration levels bracketing the expected concentration range, with a correlation coefficient of not less than 0.995 unless the reference method specifies a more stringent acceptance criterion. Each analytical batch shall include a method blank, a continuing calibration verification (CCV) at a concentration near the midpoint of the calibration range, a laboratory control sample (LCS) at a known concentration, and a matrix spike / matrix spike duplicate (MS/MSD) for every twenty (20) or fewer field samples. Acceptance criteria and corrective actions for out-of-control results shall be those defined in the Laboratory" + Apos + "s QC policy.");
        });

        AddClauseSlot(section, "Data Analysis & Reporting", "Slot_DataReporting", paragraph =>
        {
            paragraph.AppendText("Raw data shall be processed using validated algorithms and shall be reviewed by a second qualified analyst for transcription errors, units of measure, and compliance with method-defined quality control criteria. The final test report shall include, at minimum, the unique accession identifier, the test method, the analytical result with associated uncertainty (where requested), the units of measure, the date of analysis, the date of report issuance, and any deviations from the SOP that occurred during the analysis. Reports shall not be released to the client until the technical reviewer and the laboratory director (or qualified designee) have signed off in the LIMS.");
        });

        AddClauseSlot(section, "Records & Retention", "Slot_Records", paragraph =>
        {
            paragraph.AppendText("All raw data, chromatograms, spectra, calculations, and supporting documentation shall be retained for a minimum of ten (10) years from the date of report issuance, or longer where required by the applicable accreditation body, regulation, or client contract. Records shall be stored in a manner that protects them from loss, alteration, and unauthorized access, and shall be made available upon request to authorized representatives of the accreditation body, the client, and applicable regulatory authorities. The Laboratory" + Apos + "s information security controls shall comply with ISO/IEC 27001 or an equivalent recognized standard.");
        });

        AddLabeledClause(section, "Review Cycle", paragraph =>
        {
            paragraph.AppendText("This SOP shall be reviewed at minimum every ");
            paragraph.AppendField("ReviewCycle", FieldType.FieldMergeField);
            paragraph.AppendText(" by the method author, the laboratory director, and the quality manager. Each review shall confirm alignment with the published reference method, the accreditation requirements, and any changes in regulatory or client expectations. Revisions shall be version-controlled, approved by the quality manager, and communicated to every analyst prior to resumption of work under the revised procedure. The method author is responsible for initiating the review on or before the anniversary of the effective date.");
        });

        AddSignatureBlock(section, "SignatureBlock_Laboratory");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreateManufacturingSop(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Standard Operating Procedure — Production Line Operation", "Title_manufacturing");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Manufacturing Site: ", "CompanyName");
        AddFieldLine(section, "Production Supervisor: ", "CustomerContact");
        AddFieldLine(section, "Product Line: ", "ProductLine");
        AddFieldLine(section, "Primary Equipment: ", "EquipmentName");
        section.AddParagraph();

        AddBookmark(section, "Purpose", paragraph =>
        {
            paragraph.AppendText("This Standard Operating Procedure (the " + LQuote + "SOP" + RQuote + ") defines the safe and consistent method of operating the ");
            paragraph.AppendField("EquipmentName", FieldType.FieldMergeField);
            paragraph.AppendText(" equipment on the ");
            paragraph.AppendField("ProductLine", FieldType.FieldMergeField);
            paragraph.AppendText(" line at the manufacturing facility operated by ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText(" (the " + LQuote + "Facility" + RQuote + "). The SOP takes effect on ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" and is binding on every operator, lead, supervisor, maintenance technician, and quality representative assigned to the line until formally superseded or retired by the Plant Manager.");
        });

        AddBookmark(section, "Scope", paragraph =>
        {
            paragraph.AppendText("This SOP applies to the start-up, normal operation, changeover, in-process sampling, planned stop, and emergency stop of the designated equipment within the scope of the product line. It applies to all shifts and to all personnel whose work affects product quality, safety, or regulatory compliance, including third-party contractors performing work on or near the line. It does not supersede equipment-specific lockout / tagout procedures, confined-space entry permits, hot-work permits, or any other safety procedure that the Facility" + Apos + "s Environment, Health and Safety function requires for the activity being performed.");
        });

        AddBookmark(section, "Health, Safety & Environment", paragraph =>
        {
            paragraph.AppendText("Operators shall confirm the area is clear of personnel and obstructions prior to energizing the equipment, shall wear the personal protective equipment specified on the line" + Apos + "s PPE matrix, and shall adhere to the Facility" + Apos + "s Confined Space Entry, Hot Work, and Lockout / Tagout programs for any maintenance or cleaning activity that requires the removal of guards or the de-energization of equipment. Any near miss, first aid event, or recordable injury shall be reported to the production supervisor and entered into the Facility" + Apos + "s safety reporting system within the same shift. Chemical handling shall comply with the Safety Data Sheet (SDS) and the Facility" + Apos + "s Hazard Communication program.");
        });

        AddLabeledClause(section, "Regulatory References", paragraph =>
        {
            paragraph.AppendText("This SOP is issued in alignment with 21 CFR Part 211 " + LQuote + "Current Good Manufacturing Practice for Finished Pharmaceuticals" + RQuote + " (where the product line supports a regulated product), 21 CFR Part 117 " + LQuote + "Current Good Manufacturing Practice, Hazard Analysis, and Risk-Based Preventive Controls for Human Food" + RQuote + " (where the product line supports food), ISO 9001:2015, ISO 13485:2016 (where the product line supports medical devices), and the Facility" + Apos + "s Quality Management System. Where regulatory or quality system requirements conflict with this SOP, the more stringent requirement shall apply and the deviation shall be recorded in the Facility" + Apos + "s deviation management system.");
        });

        AddClauseSlot(section, "Pre-Start-Up Checks", "Slot_PreStart", paragraph =>
        {
            paragraph.AppendText("Before authorizing line start-up, the operator shall verify that the line is clear of personnel, tools, and product from the previous run; that all guards, interlocks, and emergency-stop devices are in place and tested; that the previous batch or lot has been reconciled in the Manufacturing Execution System (MES); that cleaning verification for the product contact surfaces has been completed and signed off by Quality; and that the line clearance and line clearance for the upcoming product have been performed by an operator other than the one who performed the changeover. The operator shall record each verification on the line start-up checklist and shall not energize the equipment until every item on the checklist has been initialed.");
        });

        AddClauseSlot(section, "Normal Operation", "Slot_NormalOperation", paragraph =>
        {
            paragraph.AppendText("During normal operation the operator shall monitor the line at the cadence defined in the line" + Apos + "s control plan, including critical process parameters, in-process control points, and the visual appearance of the product. The operator shall take in-process samples at the frequency defined in the batch record and shall promptly escalate any out-of-specification result to the production supervisor and the on-shift Quality representative. The operator shall not adjust a critical process parameter outside the approved operating range without written authorization from Quality. Any deviation from the SOP shall be recorded on the deviation form and shall be dispositioned by the production supervisor and the on-shift Quality representative before the lot is released.");
        });

        AddClauseSlot(section, "Changeover & Cleaning", "Slot_Changeover", paragraph =>
        {
            paragraph.AppendText("Changeover from one product to the next shall be performed in accordance with the validated cleaning procedure for the product contact surfaces and shall be sequenced to prevent cross-contamination, mix-up, and the carryover of allergens or animal-derived materials. Cleaning shall be performed by a trained operator using the documented cleaning agents, concentrations, contact times, and rinsing steps. On completion of cleaning, the line shall be inspected by the line lead and independently verified by Quality prior to release for the next product. Cleaning verification results shall be recorded in the batch record and shall be retained as part of the product history file.");
        });

        AddClauseSlot(section, "In-Process Sampling & Hold", "Slot_InProcess", paragraph =>
        {
            paragraph.AppendText("In-process samples shall be taken at the locations, frequencies, and sample sizes defined in the approved sampling plan. Each sample shall be labeled with the batch or lot identifier, the sample location, the sample time, the operator identifier, and the analytical test to be performed. Samples awaiting analytical result shall be held under quarantine in the designated sampling-hold area and shall not be released for shipment until the Quality representative has approved the lot. Lots that fail to meet acceptance criteria shall be placed on physical and electronic hold pending a non-conformance investigation, and shall be dispositioned in accordance with the Facility" + Apos + "s non-conforming product procedure.");
        });

        AddClauseSlot(section, "Planned & Emergency Stop", "Slot_Stop", paragraph =>
        {
            paragraph.AppendText("Planned stops (e.g., shift change, planned maintenance, end of campaign) shall follow the controlled-stop sequence defined in the line" + Apos + "s operating manual, including line clearance, equipment lockout where required, and reconciliation of the in-process batch in the MES. Emergency stops shall be initiated by activating the nearest emergency-stop device, after which the operator shall secure the area, perform a visual inspection of the line, and notify the production supervisor and the on-shift Quality representative. The line shall not be restarted until the cause of the stop has been investigated, the corrective action has been recorded, and a written authorization to restart has been issued by the production supervisor and the on-shift Quality representative.");
        });

        AddLabeledClause(section, "Review Cycle", paragraph =>
        {
            paragraph.AppendText("This SOP shall be reviewed at minimum every ");
            paragraph.AppendField("ReviewCycle", FieldType.FieldMergeField);
            paragraph.AppendText(" by the production supervisor, the Plant Manager, and the Quality Manager. Each review shall include a walk-through of the line, a review of deviations and non-conformances recorded during the review period, and confirmation that the SOP remains aligned with current regulatory, quality, and safety requirements. Revisions shall be version-controlled, approved by the Plant Manager, trained out to every affected employee through the Facility" + Apos + "s learning management system, and recorded in the employee training record before the revised SOP becomes effective on the line. The production supervisor is responsible for initiating the review on or before the anniversary of the effective date.");
        });

        AddSignatureBlock(section, "SignatureBlock_Manufacturing");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    /// <summary>
    /// Emits a heading paragraph bookmarked by <paramref name="bookmarkName"/>:
    /// bold, 18pt, default font.
    /// </summary>
    private static void AddHeading(IWSection section, string text, string bookmarkName)
    {
        var paragraph = section.AddParagraph();
        paragraph.AppendBookmarkStart(bookmarkName);
        var span = paragraph.AppendText(text);
        span.CharacterFormat.Bold = true;
        span.CharacterFormat.FontSize = 18f;
        span.CharacterFormat.FontName = DefaultFontName;
        paragraph.AppendBookmarkEnd(bookmarkName);
        section.AddParagraph();
    }

    /// <summary>
    /// Emits a bold label followed by a real MERGEFIELD on a single line, e.g.
    /// "Effective Date: «EffectiveDate»".
    /// </summary>
    private static void AddFieldLine(IWSection section, string label, string fieldName)
    {
        var paragraph = section.AddParagraph();
        var labelText = paragraph.AppendText(label);
        labelText.CharacterFormat.Bold = true;
        paragraph.AppendField(fieldName, FieldType.FieldMergeField);
    }

    private static void AddBookmark(IWSection section, string bookmarkName, Action<IWParagraph> body)
    {
        var paragraph = section.AddParagraph();
        paragraph.AppendBookmarkStart(bookmarkName);
        body(paragraph);
        paragraph.AppendBookmarkEnd(bookmarkName);
        section.AddParagraph();
    }

    /// <summary>
    /// Emits a clause slot: a bold label wrapped in <c>Slot_Xy</c> and a body
    /// paragraph wrapped in <c>SlotBody_Slot_Xy</c>. The frontend clause
    /// library selects the body bookmark and replaces its contents in place, so
    /// the body carries a realistic default clause (which may embed merge
    /// fields) rather than a bracketed placeholder.
    /// </summary>
    private static void AddClauseSlot(IWSection section, string slotLabel, string bookmarkName, Action<IWParagraph> body)
    {
        var labelParagraph = section.AddParagraph();
        labelParagraph.AppendBookmarkStart(bookmarkName);
        var labelText = labelParagraph.AppendText(slotLabel + ": ");
        labelText.CharacterFormat.Bold = true;
        labelParagraph.AppendBookmarkEnd(bookmarkName);

        var slotPlaceholder = section.AddParagraph();
        slotPlaceholder.AppendBookmarkStart("SlotBody_" + bookmarkName);
        body(slotPlaceholder);
        slotPlaceholder.AppendBookmarkEnd("SlotBody_" + bookmarkName);
        section.AddParagraph();
    }

    /// <summary>
    /// Emits a fixed (non-slot) clause: a bold inline label followed by body
    /// text in the same paragraph. Used for clauses that are not editable
    /// insertion targets but still carry merge fields (e.g. Governing Law).
    /// </summary>
    private static void AddLabeledClause(IWSection section, string label, Action<IWParagraph> body)
    {
        var paragraph = section.AddParagraph();
        var labelText = paragraph.AppendText(label + ": ");
        labelText.CharacterFormat.Bold = true;
        body(paragraph);
        section.AddParagraph();
    }

    private static void AddSignatureBlock(IWSection section, string bookmarkName)
    {
        section.AddParagraph();
        var signatureBlock = section.AddParagraph();
        signatureBlock.AppendBookmarkStart(bookmarkName);
        signatureBlock.AppendText("[Signature Pad Placeholder — image signature inserted here]");
        signatureBlock.AppendBookmarkEnd(bookmarkName);
        section.AddParagraph();

        var signerParagraph = section.AddParagraph();
        signerParagraph.AppendText("Signed by: _______________________     Date: ____________");
    }

    private const string DefaultFontName = "Calibri";

    /// <summary>
    /// Sets Calibri as the document default (Normal style + every text range)
    /// so the Document Editor opens templates in Calibri rather than DocIO's
    /// Times New Roman fallback.
    /// </summary>
    private static void ApplyDefaultFont(WordDocument doc)
    {
        if (doc.Styles.FindByName("Normal") is WParagraphStyle normal)
        {
            normal.CharacterFormat.FontName = DefaultFontName;
            normal.CharacterFormat.FontSize = 11f;
        }

        foreach (WSection section in doc.Sections)
        {
            foreach (WParagraph paragraph in section.Body.Paragraphs)
            {
                foreach (var item in paragraph.ChildEntities)
                {
                    if (item is WTextRange textRange)
                    {
                        textRange.CharacterFormat.FontName = DefaultFontName;
                    }
                }
            }
        }
    }
}
