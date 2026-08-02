// Remote module - safe operations only.
// Screen capture, input injection, and active indicator are disabled.
// Only polling, consent confirmation, and status reporting are available.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionRequest {
    pub session_id: String,
    pub device_id: String,
    pub technician_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionStatus {
    pub session_id: String,
    pub status: String,
    pub device_id: String,
}

#[derive(Serialize)]
pub struct ConsentDecision {
    pub session_id: String,
    pub device_id: String,
    pub granted: bool,
    pub method: String,
}
