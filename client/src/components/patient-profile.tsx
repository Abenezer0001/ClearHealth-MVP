import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    User,
    Stethoscope,
    TestTube,
    Pill,
    Calendar,
    MapPin,
} from "lucide-react";
import type { PatientProfile as PatientProfileType } from "@shared/fhir-types";

interface PatientProfileProps {
    profile: PatientProfileType;
}

export function PatientProfile({ profile }: PatientProfileProps) {
    const { demographics, conditions, labResults, medications } = profile;

    return (
        <div className="space-y-4">
            {/* Demographics Card */}
            <Card className="bg-muted/30">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg">{demographics.name}</h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                {demographics.gender && (
                                    <span className="capitalize">{demographics.gender}</span>
                                )}
                                {demographics.age !== undefined && (
                                    <span>{demographics.age} years old</span>
                                )}
                                {demographics.birthDate && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {demographics.birthDate}
                                    </span>
                                )}
                                {demographics.address?.city && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {[demographics.address.city, demographics.address.state].filter(Boolean).join(", ")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for Conditions, Labs, Medications */}
            <Tabs defaultValue="conditions" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="conditions" className="text-xs sm:text-sm">
                        <Stethoscope className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Conditions</span>
                        <span className="sm:hidden">Dx</span>
                        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                            {conditions.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="text-xs sm:text-sm">
                        <TestTube className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Labs</span>
                        <span className="sm:hidden">Lab</span>
                        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                            {labResults.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="medications" className="text-xs sm:text-sm">
                        <Pill className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Medications</span>
                        <span className="sm:hidden">Rx</span>
                        <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                            {medications.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="conditions" className="mt-4">
                    {conditions.length > 0 ? (
                        <div className="space-y-2">
                            {conditions.map((condition, idx) => (
                                <div
                                    key={`${condition.code}-${idx}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{condition.display}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {condition.code && `Code: ${condition.code}`}
                                            {condition.onsetDate && ` • Onset: ${condition.onsetDate}`}
                                        </p>
                                    </div>
                                    {condition.clinicalStatus && (
                                        <Badge
                                            variant={condition.clinicalStatus === "active" ? "default" : "secondary"}
                                            className="text-xs"
                                        >
                                            {condition.clinicalStatus}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Stethoscope} message="No conditions found" />
                    )}
                </TabsContent>

                <TabsContent value="labs" className="mt-4">
                    {labResults.length > 0 ? (
                        <div className="space-y-2">
                            {labResults.slice(0, 20).map((lab, idx) => (
                                <div
                                    key={`${lab.code}-${idx}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{lab.display}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {lab.effectiveDate && formatDate(lab.effectiveDate)}
                                            {lab.referenceRange && ` • Ref: ${lab.referenceRange}`}
                                        </p>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="font-mono text-sm font-medium">
                                            {lab.value !== undefined ? `${lab.value} ${lab.unit || ""}`.trim() : lab.valueString || "—"}
                                        </p>
                                        {lab.interpretation && (
                                            <Badge
                                                variant={
                                                    lab.interpretation === "N" ? "secondary" :
                                                        lab.interpretation === "H" || lab.interpretation === "HH" ? "destructive" :
                                                            "outline"
                                                }
                                                className="text-xs"
                                            >
                                                {lab.interpretation === "N" ? "Normal" :
                                                    lab.interpretation === "H" ? "High" :
                                                        lab.interpretation === "HH" ? "Critical High" :
                                                            lab.interpretation === "L" ? "Low" :
                                                                lab.interpretation === "LL" ? "Critical Low" :
                                                                    lab.interpretation}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {labResults.length > 20 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                    Showing 20 of {labResults.length} results
                                </p>
                            )}
                        </div>
                    ) : (
                        <EmptyState icon={TestTube} message="No lab results found" />
                    )}
                </TabsContent>

                <TabsContent value="medications" className="mt-4">
                    {medications.length > 0 ? (
                        <div className="space-y-2">
                            {medications.map((med, idx) => (
                                <div
                                    key={`${med.code}-${idx}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{med.display}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {med.dosageInstruction || "No dosage specified"}
                                            {med.authoredOn && ` • ${formatDate(med.authoredOn)}`}
                                        </p>
                                    </div>
                                    {med.status && (
                                        <Badge
                                            variant={med.status === "active" ? "default" : "secondary"}
                                            className="text-xs"
                                        >
                                            {med.status}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={Pill} message="No medications found" />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">{message}</p>
        </div>
    );
}

function formatDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return dateString;
    }
}
