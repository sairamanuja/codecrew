import os
import requests
from datetime import datetime

class EmailService:
    def __init__(self):
        self.n8n_webhook_url = os.getenv('N8N_EMAIL_WEBHOOK_URL')

    def schedule_interview_email(self, email_data):
        """
        Schedule interview email via n8n webhook only.
        Args:
            email_data (dict): Contains candidate_name, candidate_email, interview_date, interview_time, zoom_link, ats_score, behavior_score, final_score
        Returns:
            dict: Result of email scheduling
        """
        if self.n8n_webhook_url:
            try:
                resp = requests.post(self.n8n_webhook_url, json=email_data, timeout=10)
                if resp.status_code in [200, 201]:
                    return {'status': 'sent', 'via': 'n8n', 'timestamp': datetime.now().isoformat()}
                else:
                    print(f"n8n webhook failed: {resp.text}")
                    return {'status': 'failed', 'via': 'n8n', 'timestamp': datetime.now().isoformat(), 'error': resp.text}
            except Exception as e:
                print(f"n8n webhook error: {str(e)}")
                return {'status': 'failed', 'via': 'n8n', 'timestamp': datetime.now().isoformat(), 'error': str(e)}
        else:
            return {'status': 'failed', 'timestamp': datetime.now().isoformat(), 'error': 'N8N webhook URL not configured'} 