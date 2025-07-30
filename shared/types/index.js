"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_COMPATIBILITY_MATRIX = exports.ANALYSIS_FILE_APP_VERSION = exports.ANALYSIS_FILE_SCHEMA_VERSION = exports.ANALYSIS_FILE_VERSION = exports.AUTO_ANALYZE_FUNCTION_SCHEMA = exports.GPT_MODELS = exports.ANALYSIS_FUNCTION_SCHEMA = void 0;
exports.getGptModelById = getGptModelById;
exports.calculateModelCost = calculateModelCost;
exports.ANALYSIS_FUNCTION_SCHEMA = {
    name: "analyze_session",
    description: "Analyze a chatbot session and classify its intent, outcome, and key details",
    parameters: {
        type: "object",
        properties: {
            general_intent: {
                type: "string",
                description: "What the user is asking about (1-2 words). Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear."
            },
            call_outcome: {
                type: "string",
                enum: ["Transfer", "Contained"],
                description: "Whether the session was transferred to a live agent or contained by the bot"
            },
            transfer_reason: {
                type: "string",
                description: "Why the session was transferred (only if call_outcome is 'Transfer'). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number. Leave empty if not transferred."
            },
            drop_off_location: {
                type: "string",
                description: "Where in the conversation flow the user dropped off (only if call_outcome is 'Transfer'). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, Caller Name. Leave empty if not transferred."
            },
            notes: {
                type: "string",
                description: "One sentence summary of what happened in the session"
            }
        },
        required: ["general_intent", "call_outcome", "notes"]
    }
};
exports.GPT_MODELS = [
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        apiModelString: 'gpt-4o',
        inputPricePerMillion: 2.50,
        outputPricePerMillion: 10.00
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        apiModelString: 'gpt-4o-mini',
        inputPricePerMillion: 0.15,
        outputPricePerMillion: 0.60
    },
    {
        id: 'gpt-4.1',
        name: 'GPT-4.1 (base)',
        apiModelString: 'gpt-4.1',
        inputPricePerMillion: 2.00,
        outputPricePerMillion: 8.00
    },
    {
        id: 'gpt-4.1-mini',
        name: 'GPT-4.1 mini',
        apiModelString: 'gpt-4.1-mini',
        inputPricePerMillion: 0.40,
        outputPricePerMillion: 1.60
    },
    {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 nano',
        apiModelString: 'gpt-4.1-nano',
        inputPricePerMillion: 0.10,
        outputPricePerMillion: 0.40
    }
];
function getGptModelById(id) {
    return exports.GPT_MODELS.find(model => model.id === id);
}
function calculateModelCost(inputTokens, outputTokens, model) {
    const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
    return inputCost + outputCost;
}
exports.AUTO_ANALYZE_FUNCTION_SCHEMA = {
    name: "analyze_sessions_batch",
    description: "Analyze a batch of session transcripts and classify each session",
    parameters: {
        type: "object",
        properties: {
            sessions: {
                type: "array",
                description: "Array of analyzed sessions",
                items: {
                    type: "object",
                    properties: {
                        user_id: {
                            type: "string",
                            description: "The user ID of the session"
                        },
                        general_intent: {
                            type: "string",
                            description: "What the user is trying to accomplish (1-2 words). Examples: Claim Status, Billing, Eligibility, Live Agent, Provider Enrollment, Portal Access, Authorization. Use 'Unknown' if unclear."
                        },
                        session_outcome: {
                            type: "string",
                            enum: ["Transfer", "Contained"],
                            description: "Whether the session was transferred to a live agent or contained by the bot"
                        },
                        transfer_reason: {
                            type: "string",
                            description: "Why the session was transferred (only if session_outcome is 'Transfer'). Examples: Invalid Provider ID, Invalid Member ID, Invalid Claim Number, No Provider ID, Inactive Provider ID, Authentication Failed, Technical Issue, Policy Not Found, Can't Capture Policy Number. Leave empty if not transferred."
                        },
                        drop_off_location: {
                            type: "string",
                            description: "Where in the session flow (at which prompt) the user dropped off (started getting routed to an agent). Will only have a value if session_outcome is 'Transfer'). Examples: Policy Number Prompt, Authentication, Claim Details, Member Information, Provider ID, Date of Service, User Name. Leave empty if not transferred."
                        },
                        notes: {
                            type: "string",
                            description: "One sentence summary of what happened in the session"
                        }
                    },
                    required: ["user_id", "general_intent", "session_outcome", "transfer_reason", "drop_off_location", "notes"]
                }
            }
        },
        required: ["sessions"]
    }
};
exports.ANALYSIS_FILE_VERSION = "1.0.0";
exports.ANALYSIS_FILE_SCHEMA_VERSION = "1.0";
exports.ANALYSIS_FILE_APP_VERSION = "XOB-CAT-1.0.0";
exports.VERSION_COMPATIBILITY_MATRIX = {
    "1.0": {
        supportedVersions: ["1.0.0", "1.0.1", "1.0.2"],
        deprecatedVersions: [],
        unsupportedVersions: [],
        requiredFeatures: ["basic-charts", "session-analysis"],
        optionalFeatures: ["advanced-charts", "ai-summary"]
    }
};
//# sourceMappingURL=index.js.map