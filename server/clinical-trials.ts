import type {
    ClinicalTrial,
    TrialSearchParams,
    TrialSearchResponse,
    TrialContact,
    TrialLocation,
    TrialEligibility,
} from "@shared/trials";
import https from "node:https";

const API_BASE = "https://clinicaltrials.gov/api/v2";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;

type JsonRequestResult<T> = {
    status: number;
    data: T;
};

function requestJson<T>(
    url: string,
    redirectCount = 0
): Promise<JsonRequestResult<T>> {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                family: 4,
                timeout: REQUEST_TIMEOUT_MS,
                headers: {
                    Accept: "application/json",
                },
            },
            (res) => {
                const status = res.statusCode ?? 0;
                const location = res.headers.location;

                if (
                    status >= 300 &&
                    status < 400 &&
                    location &&
                    redirectCount < MAX_REDIRECTS
                ) {
                    res.resume();
                    const redirectUrl = new URL(location, url).toString();
                    resolve(requestJson<T>(redirectUrl, redirectCount + 1));
                    return;
                }

                if (status >= 300 && status < 400 && location) {
                    res.resume();
                    reject(
                        new Error(
                            `ClinicalTrials.gov redirect limit exceeded (${MAX_REDIRECTS})`
                        )
                    );
                    return;
                }

                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => {
                    body += chunk;
                });
                res.on("end", () => {
                    if (!body.trim()) {
                        resolve({ status, data: {} as T });
                        return;
                    }
                    try {
                        const parsed = JSON.parse(body) as T;
                        resolve({ status, data: parsed });
                    } catch {
                        reject(
                            new Error(
                                `ClinicalTrials.gov returned invalid JSON (status ${status})`
                            )
                        );
                    }
                });
            }
        );

        req.on("timeout", () => {
            req.destroy(
                new Error(
                    `ClinicalTrials.gov request timed out after ${REQUEST_TIMEOUT_MS}ms`
                )
            );
        });
        req.on("error", reject);
    });
}

// Map raw API study to our ClinicalTrial interface
function mapStudyToTrial(study: any): ClinicalTrial {
    const protocol = study.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const description = protocol.descriptionModule || {};
    const conditions = protocol.conditionsModule || {};
    const design = protocol.designModule || {};
    const eligibility = protocol.eligibilityModule || {};
    const contacts = protocol.contactsLocationsModule || {};
    const arms = protocol.armsInterventionsModule || {};
    const sponsor = protocol.sponsorCollaboratorsModule || {};

    // Map locations
    const locations: TrialLocation[] = (contacts.locations || []).map(
        (loc: any) => ({
            facility: loc.facility,
            city: loc.city,
            state: loc.state,
            country: loc.country,
            status: loc.status,
            contacts: (loc.contacts || []).map((c: any) => ({
                name: c.name,
                role: c.role,
                phone: c.phone,
                email: c.email,
            })),
        })
    );

    // Map central contacts
    const centralContacts: TrialContact[] = (
        contacts.centralContacts || []
    ).map((c: any) => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email,
    }));

    // Map eligibility
    const eligibilityInfo: TrialEligibility = {
        criteria: eligibility.eligibilityCriteria,
        healthyVolunteers: eligibility.healthyVolunteers,
        sex: eligibility.sex,
        minimumAge: eligibility.minimumAge,
        maximumAge: eligibility.maximumAge,
        stdAges: eligibility.stdAges,
    };

    // Map interventions
    const interventions = (arms.interventions || []).map((i: any) => ({
        type: i.type,
        name: i.name,
        description: i.description,
    }));

    return {
        nctId: identification.nctId || "",
        briefTitle: identification.briefTitle || "Untitled Study",
        officialTitle: identification.officialTitle,
        briefSummary: description.briefSummary,
        detailedDescription: description.detailedDescription,
        overallStatus: status.overallStatus || "UNKNOWN",
        phases: design.phases,
        studyType: design.studyType,
        conditions: conditions.conditions || [],
        interventions,
        eligibility: eligibilityInfo,
        locations,
        centralContacts,
        sponsor: sponsor.leadSponsor
            ? {
                name: sponsor.leadSponsor.name,
                class: sponsor.leadSponsor.class,
            }
            : undefined,
        startDate: status.startDateStruct?.date,
        completionDate: status.completionDateStruct?.date,
        enrollmentCount: design.enrollmentInfo?.count,
        lastUpdateDate: status.lastUpdateSubmitDate,
    };
}

// Search clinical trials
export async function searchTrials(
    params: TrialSearchParams
): Promise<TrialSearchResponse> {
    const url = new URL(`${API_BASE}/studies`);

    // Add query parameters
    url.searchParams.set("format", "json");
    url.searchParams.set("pageSize", String(params.pageSize || 20));

    // Condition search
    if (params.condition && params.condition.trim()) {
        url.searchParams.set("query.cond", params.condition.trim());
    }

    // Location search
    if (params.location && params.location.trim()) {
        url.searchParams.set("query.locn", params.location.trim());
    }

    // Status filter (comma-separated list)
    if (params.status && params.status.trim()) {
        url.searchParams.set("filter.overallStatus", params.status.trim());
    }

    // Phase filter
    if (params.phase && params.phase.trim()) {
        url.searchParams.set(
            "filter.advanced",
            `AREA[Phase]${params.phase.trim()}`
        );
    }

    // Pagination token
    if (params.pageToken) {
        url.searchParams.set("pageToken", params.pageToken);
    }

    // Request specific fields for efficiency
    url.searchParams.set(
        "fields",
        [
            "NCTId",
            "BriefTitle",
            "OfficialTitle",
            "BriefSummary",
            "OverallStatus",
            "Phase",
            "StudyType",
            "Condition",
            "InterventionName",
            "InterventionType",
            "EligibilityCriteria",
            "HealthyVolunteers",
            "Sex",
            "MinimumAge",
            "MaximumAge",
            "StdAge",
            "LocationCity",
            "LocationState",
            "LocationCountry",
            "LocationFacility",
            "LocationStatus",
            "CentralContactName",
            "CentralContactPhone",
            "CentralContactEMail",
            "LeadSponsorName",
            "StartDate",
            "CompletionDate",
            "EnrollmentCount",
            "LastUpdateSubmitDate",
        ].join(",")
    );

    try {
        const { status, data } = await requestJson<any>(url.toString());
        if (status < 200 || status >= 300) {
            throw new Error(`ClinicalTrials.gov API error: ${status}`);
        }

        return {
            studies: (data.studies || []).map(mapStudyToTrial),
            totalCount: data.totalCount || 0,
            nextPageToken: data.nextPageToken,
        };
    } catch (error) {
        console.error("Error fetching trials:", error);
        throw error;
    }
}

// Get a single trial by NCT ID
export async function getTrialByNctId(
    nctId: string
): Promise<ClinicalTrial | null> {
    const url = new URL(`${API_BASE}/studies/${nctId}`);
    url.searchParams.set("format", "json");

    try {
        const { status, data } = await requestJson<any>(url.toString());
        if (status === 404) {
            return null;
        }

        if (status < 200 || status >= 300) {
            throw new Error(`ClinicalTrials.gov API error: ${status}`);
        }

        return mapStudyToTrial(data);
    } catch (error) {
        console.error("Error fetching trial:", error);
        throw error;
    }
}
