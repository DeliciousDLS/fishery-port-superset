# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Request-scoped guest authentication that preserves browser login sessions."""

from flask import current_app, request
from flask_login import LoginManager, user_accessed


class GuestTokenLoginManager(LoginManager):
    """Prefer explicit guest credentials without changing the cookie identity."""

    def _load_user(self) -> None:
        # Import lazily to avoid an initialization cycle with the security manager.
        from superset.extensions import (
            feature_flag_manager,  # pylint: disable=import-outside-toplevel
        )

        if feature_flag_manager.is_feature_enabled("EMBEDDED_SUPERSET") and (
            current_app.config["GUEST_TOKEN_HEADER_NAME"] in request.headers
            or "guest_token" in request.form
        ):
            # Invalid and empty tokens must remain anonymous, never fall back to
            # an administrator session or a remember-me cookie in this browser.
            user_accessed.send(current_app._get_current_object())
            self._update_request_context_with_user(
                self._load_user_from_request(request)
            )
            return
        super()._load_user()
