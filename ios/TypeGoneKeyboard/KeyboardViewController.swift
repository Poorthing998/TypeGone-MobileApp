import UIKit

class KeyboardViewController: UIInputViewController {

    var recordButton: UIButton!
    var statusLabel: UILabel!

    override func updateViewConstraints() {
        super.updateViewConstraints()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
    }
    
    private func setupUI() {
        self.view.backgroundColor = UIColor(white: 0.95, alpha: 1.0)
        
        statusLabel = UILabel()
        statusLabel.text = "TypeGone Voice"
        statusLabel.font = UIFont.boldSystemFont(ofSize: 18)
        statusLabel.textColor = .darkGray
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(statusLabel)
        
        recordButton = UIButton(type: .system)
        recordButton.setTitle("Tap to Insert Text", for: .normal)
        recordButton.backgroundColor = UIColor.systemBlue
        recordButton.setTitleColor(.white, for: .normal)
        recordButton.layer.cornerRadius = 8
        recordButton.translatesAutoresizingMaskIntoConstraints = false
        recordButton.addTarget(self, action: #selector(handleRecordTap), for: .touchUpInside)
        self.view.addSubview(recordButton)
        
        NSLayoutConstraint.activate([
            statusLabel.centerXAnchor.constraint(equalTo: self.view.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: self.view.topAnchor, constant: 20),
            
            recordButton.centerXAnchor.constraint(equalTo: self.view.centerXAnchor),
            recordButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            recordButton.widthAnchor.constraint(equalToConstant: 200),
            recordButton.heightAnchor.constraint(equalToConstant: 50),
            recordButton.bottomAnchor.constraint(lessThanOrEqualTo: self.view.bottomAnchor, constant: -20)
        ])
    }
    
    @objc func handleRecordTap() {
        // Placeholder: Trigger actual voice capture & API request
        let proxy = self.textDocumentProxy as UITextDocumentProxy
        proxy.insertText(" [TypeGone Voice Placeholder (iOS)] ")
    }
}
