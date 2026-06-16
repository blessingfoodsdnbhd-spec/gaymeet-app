Pod::Spec.new do |s|
  s.name           = 'NativeSheet'
  s.version        = '1.0.0'
  s.summary        = 'Native OS dialog/sheet bridge (fly-up-proof)'
  s.description    = 'Wraps UIAlertController so confirm/choice UI is system-drawn, not an RN Modal.'
  s.author         = ''
  s.homepage       = 'https://meyou.uk'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
