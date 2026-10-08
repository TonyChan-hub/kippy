export type ApkEntry = {
  path: string;
  size: number;
  compressedSize: number;
  compressed: boolean;
};

export type ComponentInfo = {
  name: string;
  exported?: string | null;
  enabled?: string | null;
  permission?: string | null;
};

export type SignerCertificate = {
  scheme: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validUntil: string;
  signatureType: string;
  sha256: string;
  sha1: string;
  md5: string;
};

export type NativeLibCheck = {
  path: string;
  abi: string;
  compressed: boolean;
  zipAligned?: boolean | null;
  zipDataOffset?: number | null;
  elfAligned?: boolean | null;
  loadAligns: number[];
  maxLoadAlign?: number | null;
  notes: string[];
};

export type SizeCategory = {
  id: string;
  label: string;
  uncompressed: number;
  compressed: number;
  fileCount: number;
  installPct: number;
  downloadPct: number;
};

export type SizeEntryShare = {
  path: string;
  uncompressed: number;
  compressed: number;
  installPct: number;
  category: string;
};

export type DexFileStats = {
  path: string;
  size: number;
  version: string;
  classes: number;
  methods: number;
  fields: number;
  strings: number;
  hasDebugInfo: boolean;
};

export type DexAnalysis = {
  fileCount: number;
  totalSize: number;
  classes: number;
  methods: number;
  fields: number;
  strings: number;
  protoIds: number;
  hasDebugInfo: boolean;
  debugInfoItems: number;
  optimized: boolean;
  optimizationScorePct: number;
  notes: string[];
  files: DexFileStats[];
};

export type ObfuscationAnalysis = {
  obfuscationPct: number;
  obfuscatedClasses: number;
  readableClasses: number;
  totalClasses: number;
  shrinkPct: number;
  zipShrinkPct: number;
  codeShrinkHintPct: number;
  samplesObfuscated: string[];
  samplesReadable: string[];
  notes: string[];
};

export type SizeAnalysis = {
  fileSizeBytes: number;
  totalUncompressed: number;
  totalCompressed: number;
  zipShrinkPct: number;
  categories: SizeCategory[];
  topEntries: SizeEntryShare[];
  dex: DexAnalysis;
  obfuscation: ObfuscationAnalysis;
};

export type ApkReport = {
  path: string;
  fileName: string;
  format: string;
  sizeBytes: number;
  entryCount: number;
  summary: {
    packageName?: string | null;
    versionName?: string | null;
    versionCode?: string | null;
    minSdk?: string | null;
    targetSdk: number;
    compileSdk?: string | null;
    label?: string | null;
    debuggable?: string | null;
    allowBackup?: string | null;
    mainActivity?: string | null;
    abis: string[];
    multidex: boolean;
    modules: string[];
  };
  manifest: {
    xml: string;
    permissions: string[];
    features: string[];
    activities: ComponentInfo[];
    services: ComponentInfo[];
    receivers: ComponentInfo[];
    providers: ComponentInfo[];
  };
  signing: {
    schemes: string[];
    certificates: SignerCertificate[];
  };
  page16kb: {
    compatible: boolean;
    hasNativeLibs: boolean;
    checkedAbis: string[];
    summary: string;
    libraries: NativeLibCheck[];
  };
  sizeAnalysis: SizeAnalysis;
  resources: {
    assets: ApkEntry[];
    raw: ApkEntry[];
    otherRes: ApkEntry[];
    nativeLibs: ApkEntry[];
    dex: ApkEntry[];
    metaInf: ApkEntry[];
  };
  entries: ApkEntry[];
};

export type UnpackResult = {
  dest: string;
  extracted: number;
  skipped: number;
};

export type EntryPreview = {
  path: string;
  size: number;
  truncated: boolean;
  isText: boolean;
  text?: string | null;
  base64?: string | null;
  contentType: string;
};

export type ApkTab =
  | 'overview'
  | 'size'
  | '16kb'
  | 'signing'
  | 'manifest'
  | 'resources'
  | 'files';
