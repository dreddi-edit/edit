// Professional Component Library for Site Editor
export const COMPONENT_LIBRARY = {
  heroSection: {
    name: "Hero Section",
    category: "layout",
    template: `<div class="wp-block-group" style="padding:80px 20px; text-align:center; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <h1 class="wp-block-heading" style="font-size:3.5rem; margin-bottom:20px; color:white;">Transform Your Ideas Into Reality</h1>
  <p style="font-size:1.25rem; margin-bottom:30px; color:rgba(255,255,255,0.9); max-width:600px; margin-left:auto; margin-right:auto;">Build stunning websites with our powerful editor. No coding required.</p>
  <div class="wp-block-button">
    <a class="wp-block-button__link" href="#" style="background:white; color:#667eea; padding:15px 30px; border-radius:8px; font-weight:bold;">Get Started Free</a>
  </div>
</div>`,
    description: "Eye-catching hero section with gradient background"
  },
  
  pricingTable: {
    name: "Pricing Table",
    category: "business",
    template: `<div class="wp-block-group" style="padding:60px 20px; background:#f8f9fa;">
  <h2 class="wp-block-heading" style="text-align:center; margin-bottom:40px; font-size:2.5rem;">Choose Your Plan</h2>
  <div class="wp-block-columns" style="gap:30px; max-width:1200px; margin:0 auto;">
    <div class="wp-block-column" style="flex:1; background:white; padding:30px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <h3 style="font-size:1.5rem; margin-bottom:20px;">Starter</h3>
      <div style="font-size:3rem; font-weight:bold; margin-bottom:20px;">$9<span style="font-size:1rem; font-weight:normal;">/month</span></div>
      <ul style="list-style:none; padding:0; margin-bottom:30px;">
        <li style="padding:8px 0;">✓ 5 Projects</li>
        <li style="padding:8px 0;">✓ Basic Templates</li>
        <li style="padding:8px 0;">✓ Email Support</li>
      </ul>
      <div class="wp-block-button">
        <a class="wp-block-button__link" href="#" style="width:100%; text-align:center;">Start Free Trial</a>
      </div>
    </div>
    <div class="wp-block-column" style="flex:1; background:#667eea; color:white; padding:30px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1); transform:scale(1.05);">
      <h3 style="font-size:1.5rem; margin-bottom:20px;">Professional</h3>
      <div style="font-size:3rem; font-weight:bold; margin-bottom:20px;">$29<span style="font-size:1rem; font-weight:normal;">/month</span></div>
      <ul style="list-style:none; padding:0; margin-bottom:30px;">
        <li style="padding:8px 0;">✓ Unlimited Projects</li>
        <li style="padding:8px 0;">✓ Premium Templates</li>
        <li style="padding:8px 0;">✓ Priority Support</li>
        <li style="padding:8px 0;">✓ Advanced Analytics</li>
      </ul>
      <div class="wp-block-button">
        <a class="wp-block-button__link" href="#" style="width:100%; text-align:center; background:white; color:#667eea;">Most Popular</a>
      </div>
    </div>
  </div>
</div>`,
    description: "Professional pricing table with multiple tiers"
  },

  testimonialGrid: {
    name: "Testimonial Grid",
    category: "social",
    template: `<div class="wp-block-group" style="padding:60px 20px; background:white;">
  <h2 class="wp-block-heading" style="text-align:center; margin-bottom:40px; font-size:2.5rem;">What Our Customers Say</h2>
  <div class="wp-block-columns" style="gap:30px; max-width:1200px; margin:0 auto;">
    <div class="wp-block-column" style="flex:1; padding:30px; background:#f8f9fa; border-radius:12px;">
      <div style="font-size:1.25rem; margin-bottom:20px; line-height:1.6;">"This editor completely transformed how we build websites. Saved us hours of development time."</div>
      <div style="display:flex; align-items:center; gap:15px;">
        <div style="width:50px; height:50px; border-radius:50%; background:#667eea;"></div>
        <div>
          <div style="font-weight:bold;">Sarah Johnson</div>
          <div style="color:#666; font-size:0.9rem;">CEO, TechStart</div>
        </div>
      </div>
    </div>
    <div class="wp-block-column" style="flex:1; padding:30px; background:#f8f9fa; border-radius:12px;">
      <div style="font-size:1.25rem; margin-bottom:20px; line-height:1.6;">"The AI features are incredible. It's like having a professional designer on your team."</div>
      <div style="display:flex; align-items:center; gap:15px;">
        <div style="width:50px; height:50px; border-radius:50%; background:#764ba2;"></div>
        <div>
          <div style="font-weight:bold;">Mike Chen</div>
          <div style="color:#666; font-size:0.9rem;">Designer, Creative Studio</div>
        </div>
      </div>
    </div>
    <div class="wp-block-column" style="flex:1; padding:30px; background:#f8f9fa; border-radius:12px;">
      <div style="font-size:1.25rem; margin-bottom:20px; line-height:1.6;">"Finally, an editor that understands what designers actually need."</div>
      <div style="display:flex; align-items:center; gap:15px;">
        <div style="width:50px; height:50px; border-radius:50%; background:#f093fb;"></div>
        <div>
          <div style="font-weight:bold;">Emily Davis</div>
          <div style="color:#666; font-size:0.9rem;">Marketing Director</div>
        </div>
      </div>
    </div>
  </div>
</div>`,
    description: "Customer testimonials in a responsive grid"
  },

  contactForm: {
    name: "Contact Form",
    category: "forms",
    template: `<div class="wp-block-group" style="padding:60px 20px; background:#f8f9fa;">
  <h2 class="wp-block-heading" style="text-align:center; margin-bottom:40px; font-size:2.5rem;">Get In Touch</h2>
  <form style="max-width:600px; margin:0 auto; background:white; padding:40px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="margin-bottom:20px;">
      <label style="display:block; margin-bottom:8px; font-weight:600;">Name *</label>
      <input type="text" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:6px; font-size:16px;" />
    </div>
    <div style="margin-bottom:20px;">
      <label style="display:block; margin-bottom:8px; font-weight:600;">Email *</label>
      <input type="email" required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:6px; font-size:16px;" />
    </div>
    <div style="margin-bottom:20px;">
      <label style="display:block; margin-bottom:8px; font-weight:600;">Subject</label>
      <input type="text" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:6px; font-size:16px;" />
    </div>
    <div style="margin-bottom:20px;">
      <label style="display:block; margin-bottom:8px; font-weight:600;">Message *</label>
      <textarea required style="width:100%; padding:12px; border:1px solid #ddd; border-radius:6px; font-size:16px; min-height:120px; resize:vertical;"></textarea>
    </div>
    <div class="wp-block-button">
      <button type="submit" style="width:100%; padding:15px; background:#667eea; color:white; border:none; border-radius:6px; font-size:16px; font-weight:600; cursor:pointer;">Send Message</button>
    </div>
  </form>
</div>`,
    description: "Professional contact form with validation"
  },

  featureGrid: {
    name: "Feature Grid",
    category: "layout",
    template: `<div class="wp-block-group" style="padding:60px 20px; background:white;">
  <h2 class="wp-block-heading" style="text-align:center; margin-bottom:40px; font-size:2.5rem;">Powerful Features</h2>
  <div class="wp-block-columns" style="gap:30px; max-width:1200px; margin:0 auto;">
    <div class="wp-block-column" style="flex:1; text-align:center; padding:30px;">
      <div style="width:80px; height:80px; margin:0 auto 20px; background:#667eea; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:2rem;">↗</div>
      <h3 style="font-size:1.5rem; margin-bottom:15px;">Lightning Fast</h3>
      <p style="color:#666; line-height:1.6;">Optimized performance that loads your content in milliseconds.</p>
    </div>
    <div class="wp-block-column" style="flex:1; text-align:center; padding:30px;">
      <div style="width:80px; height:80px; margin:0 auto 20px; background:#764ba2; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:2rem;">◈</div>
      <h3 style="font-size:1.5rem; margin-bottom:15px;">Beautiful Design</h3>
      <p style="color:#666; line-height:1.6;">Professional templates that make your content shine.</p>
    </div>
    <div class="wp-block-column" style="flex:1; text-align:center; padding:30px;">
      <div style="width:80px; height:80px; margin:0 auto 20px; background:#f093fb; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:2rem;">▣</div>
      <h3 style="font-size:1.5rem; margin-bottom:15px;">Mobile Ready</h3>
      <p style="color:#666; line-height:1.6;">Perfect responsive design on all devices and screen sizes.</p>
    </div>
  </div>
</div>`,
    description: "Grid layout showcasing key features"
  }
};

export const COMPONENT_CATEGORIES = {
  layout: { name: "Layout", icon: "▣" },
  business: { name: "Business", icon: "◈" },
  social: { name: "Social", icon: "◉" },
  forms: { name: "Forms", icon: "≡" }
};
