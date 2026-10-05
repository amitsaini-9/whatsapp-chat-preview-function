import os
import functions_framework

@functions_framework.http
def serve_interface(request):
    """HTTP Cloud Function that serves the WhatsApp interface HTML."""
    html_path = os.path.join(os.path.dirname(__file__), 'index.html')
    
    try:
        with open(html_path, 'r') as f:
            html_content = f.read()
            
        return (html_content, 200, {'Content-Type': 'text/html'})
    except Exception as e:
        return (f"Error loading interface: {str(e)}", 500)
