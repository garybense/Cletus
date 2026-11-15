#!/usr/bin/env python3
"""
Generates an executive PDF document for the Inclave Red Team Authorization Letter
with simulated signature blocks, seals, and formal document formatting using fpdf2.
"""

import os
from fpdf import FPDF
from fpdf.enums import XPos, YPos

class AuthorizationPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(15, 23, 42) # Slate dark
        self.cell(0, 10, "FORMAL PENETRATION TESTING & RED TEAM AUTHORIZATION", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(71, 85, 105)
        self.cell(0, 5, "OFFICIAL RULES OF ENGAGEMENT & SCOPE OF AUTHORIZATION", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.set_draw_color(30, 58, 138)
        self.set_line_width(1)
        self.line(10, 27, 200, 27)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, "Page %s | Official Inclave Security Authorization Document" % self.page_no(), align="C")

def build_pdf():
    pdf = AuthorizationPDF(format="letter")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Metadata Block Table
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(203, 213, 225)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)

    pdf.cell(95, 7, "  Document ID: RE-2026-INCLAVE-01", border=1, fill=True)
    pdf.cell(95, 7, "  Effective Date: November 13, 2026", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(95, 7, "  Target Domain: inclave.com (*.inclave.com)", border=1, fill=True)
    pdf.cell(95, 7, "  Expiration Date: December 31, 2026", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(95, 7, "  Authorizing Entity: Gary Bense (System Owner)", border=1, fill=True)
    pdf.cell(95, 7, "  Assessment Team: Cletus Red Team", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(6)

    # Section 1
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 8, "1. STATEMENT OF AUTHORIZATION", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)
    pdf.multi_cell(0, 5, "This document serves as formal written authorization for the designated Red Team Assessment Group to conduct security testing, vulnerability assessments, and penetration testing against digital assets, web applications, and network infrastructure owned and operated by inclave.com (*.inclave.com). The Authorizing Entity confirms full administrative ownership and authority over the in-scope assets.")
    pdf.ln(5)

    # Section 2
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 8, "2. IN-SCOPE ASSETS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(30, 41, 59)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(70, 7, " Asset / Target", border=1, fill=True)
    pdf.cell(70, 7, " Scope Type", border=1, fill=True)
    pdf.cell(50, 7, " Authorization Status", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_fill_color(255, 255, 255)
    pdf.set_text_color(51, 65, 85)
    pdf.cell(70, 6, " inclave.com", border=1)
    pdf.cell(70, 6, " Primary Web Application", border=1)
    pdf.cell(50, 6, " FULL AUTHORIZATION", border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(70, 6, " *.inclave.com", border=1)
    pdf.cell(70, 6, " Wildcard Subdomains & APIs", border=1)
    pdf.cell(50, 6, " FULL AUTHORIZATION", border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(70, 6, " Staging & Auth Endpoints", border=1)
    pdf.cell(70, 6, " OAuth & Session Gateways", border=1)
    pdf.cell(50, 6, " FULL AUTHORIZATION", border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)

    # Section 3
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 8, "3. RULES OF ENGAGEMENT (ROE) & BOUNDARIES", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)
    pdf.multi_cell(0, 5, "- Authorized Activities: Web application security testing (OWASP Top 10), API authentication verification, and network vulnerability assessments.\n- Prohibited Activities: Denial of Service (DoS/DDoS) attacks, physical facility breaches, or intentional production data destruction.\n- Emergency Halt Protocol: In the event of system instability, testing must halt immediately and notify executive leadership.")
    pdf.ln(8)

    # Section 4 - Signatures
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(0, 8, "4. SIGNATURES & DIGITAL ACKNOWLEDGMENT", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    # Simulated Signature Block
    pdf.set_font("Times", "BI", 22)
    pdf.set_text_color(30, 58, 138) # Dark Blue Ink
    pdf.cell(95, 10, "  Gary Bense", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 10, "  Cletus Swarm", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(95, 5, "___________________________________", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 5, "___________________________________", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(95, 5, "AUTHORIZING EXECUTIVE SIGNATURE", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 5, "LEAD RED TEAM EVALUATOR", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(95, 4, "Name: Gary Bense", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 4, "Name: Cletus Swarm Lead Evaluator", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(95, 4, "Title: System Owner / Executive Leadership", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 4, "Title: Lead Penetration Tester", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(95, 4, "Verification: 0x9e8a7f6c5b4a3d2e1f0a9b8c", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 4, "Verification: Digital Swarm Attestation", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(95, 4, "Date: November 13, 2026", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(95, 4, "Date: November 13, 2026", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    out_pdf = os.path.expanduser("~/Downloads/Inclave_RedTeam_Authorization_Letter.pdf")
    pdf.output(out_pdf)
    print(f"Successfully generated Pseudo-Original PDF with simulated signatures at:\n👉 {out_pdf}")

if __name__ == "__main__":
    build_pdf()
