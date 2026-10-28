import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// An editable quantity input with [-] and [+] controls and direct numeric manual typing.
/// Automatically recalculates on change while enforcing positive quantities and stock limits.
class EditableQtyInput extends StatefulWidget {
  final int qty;
  final int availableStock;
  final ValueChanged<int> onQtyChanged;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  const EditableQtyInput({
    super.key,
    required this.qty,
    this.availableStock = 0,
    required this.onQtyChanged,
    required this.onIncrement,
    required this.onDecrement,
  });

  @override
  State<EditableQtyInput> createState() => _EditableQtyInputState();
}

class _EditableQtyInputState extends State<EditableQtyInput> {
  late TextEditingController _controller;
  late FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: '${widget.qty}');
    _focusNode = FocusNode();
    _focusNode.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (!_focusNode.hasFocus) {
      final text = _controller.text.trim();
      final parsed = int.tryParse(text);
      if (parsed == null || parsed <= 0) {
        _controller.text = '${widget.qty}';
      } else if (widget.availableStock > 0 && parsed > widget.availableStock) {
        _controller.text = '${widget.availableStock}';
        widget.onQtyChanged(widget.availableStock);
        _showStockWarning(widget.availableStock);
      } else {
        widget.onQtyChanged(parsed);
      }
    }
  }

  void _showStockWarning(int max) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Cannot exceed available stock ($max)'),
        backgroundColor: const Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  void didUpdateWidget(covariant EditableQtyInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_focusNode.hasFocus && oldWidget.qty != widget.qty) {
      _controller.text = '${widget.qty}';
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _handleSubmitted(String val) {
    final parsed = int.tryParse(val.trim());
    if (parsed == null || parsed <= 0) {
      _controller.text = '${widget.qty}';
    } else if (widget.availableStock > 0 && parsed > widget.availableStock) {
      _controller.text = '${widget.availableStock}';
      widget.onQtyChanged(widget.availableStock);
      _showStockWarning(widget.availableStock);
    } else {
      widget.onQtyChanged(parsed);
    }
    _focusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Decrement button [-]
        InkWell(
          onTap: widget.onDecrement,
          borderRadius: BorderRadius.circular(4),
          child: Container(
            width: 20,
            height: 20,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: const Color(0xFFCBD5E1)),
              color: const Color(0xFFF8FAFC),
            ),
            child: const Icon(Icons.remove, size: 12, color: Color(0xFF334155)),
          ),
        ),
        // Editable quantity text field
        Container(
          width: 30,
          height: 22,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: _focusNode.hasFocus ? const Color(0xFF1D4ED8) : const Color(0xFFCBD5E1),
              width: _focusNode.hasFocus ? 1.4 : 1.0,
            ),
            color: Colors.white,
          ),
          child: TextField(
            controller: _controller,
            focusNode: _focusNode,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            textAlignVertical: TextAlignVertical.center,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              contentPadding: EdgeInsets.zero,
            ),
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(4),
            ],
            onChanged: (val) {
              final parsed = int.tryParse(val.trim());
              if (parsed != null && parsed > 0) {
                if (widget.availableStock > 0 && parsed > widget.availableStock) {
                  _showStockWarning(widget.availableStock);
                  widget.onQtyChanged(widget.availableStock);
                } else {
                  widget.onQtyChanged(parsed);
                }
              }
            },
            onSubmitted: _handleSubmitted,
          ),
        ),
        // Increment button [+]
        InkWell(
          onTap: () {
            if (widget.availableStock > 0 && widget.qty >= widget.availableStock) {
              _showStockWarning(widget.availableStock);
              return;
            }
            widget.onIncrement();
          },
          borderRadius: BorderRadius.circular(4),
          child: Container(
            width: 20,
            height: 20,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: const Color(0xFFCBD5E1)),
              color: const Color(0xFFF8FAFC),
            ),
            child: const Icon(Icons.add, size: 12, color: Color(0xFF334155)),
          ),
        ),
      ],
    );
  }
}
